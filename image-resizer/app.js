// ==========================================
// 스마트 이미지 리사이저 핵심 로직 (app.js)
// ==========================================

// DOM 요소 선택
const ratioRadios = document.querySelectorAll('input[name="ratio"]');
const customRatioInputs = document.getElementById('custom-ratio-inputs');
const customWidthInput = document.getElementById('custom-width');
const customHeightInput = document.getElementById('custom-height');

const modeRadios = document.querySelectorAll('input[name="mode"]');
const paddingColorGroup = document.getElementById('padding-color-group');
const paddingColorInput = document.getElementById('padding-color');
const colorHexText = document.getElementById('color-hex-text');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const imageList = document.getElementById('image-list');
const processedCountSpan = document.getElementById('processed-count');
const downloadAllBtn = document.getElementById('download-all-btn');

// 전역 상태
let processedImagesCount = 0;
let totalImagesToProcess = 0;
const processedFilesMap = new Map(); // id -> { name, blob }

// 큐 및 동시성 제어 (메모리 보호)
const MAX_CONCURRENCY = 3; 
let activeTasks = 0;
const taskQueue = [];


// ==========================================
// 1. UI 이벤트 리스너 설정
// ==========================================

// 비율 선택 변경 시 커스텀 입력창 토글
ratioRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      customRatioInputs.classList.remove('hidden');
    } else {
      customRatioInputs.classList.add('hidden');
    }
  });
});

// 모드 선택 변경 시 패딩 색상 선택기 토글
modeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'crop') {
      paddingColorGroup.style.opacity = '0.5';
      paddingColorInput.disabled = true;
    } else {
      paddingColorGroup.style.opacity = '1';
      paddingColorInput.disabled = false;
    }
  });
});

// 패딩 색상 변경 시 텍스트 업데이트
paddingColorInput.addEventListener('input', (e) => {
  colorHexText.textContent = e.target.value.toUpperCase();
});


// ==========================================
// 2. 드래그 앤 드롭 및 파일 업로드 처리
// ==========================================

// 드래그 이벤트 기본 동작 방지
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// 시각적 피드백
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

// 파일 드롭 처리
dropZone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  handleFiles(files);
});

// 버튼 파일 선택 처리
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) return;

  // 큐에 추가하고 렌더링
  imageFiles.forEach(file => {
    const taskId = 'task_' + Math.random().toString(36).substr(2, 9);
    
    // UI에 리스트 아이템 추가
    createListItemUI(taskId, file.name);

    // 큐에 태스크 추가
    taskQueue.push({ id: taskId, file });
  });

  totalImagesToProcess += imageFiles.length;
  updateDownloadAllBtnState();
  
  // 큐 실행 트리거
  processQueue();
}


// ==========================================
// 3. UI 생성 로직
// ==========================================

function createListItemUI(id, filename) {
  const li = document.createElement('li');
  li.className = 'image-item';
  li.id = id;

  li.innerHTML = `
    <img src="" class="thumbnail" id="thumb_${id}">
    <div class="item-info">
      <span class="item-name">${filename}</span>
      <div class="progress-container">
        <div class="progress-bar" id="prog_${id}"></div>
      </div>
    </div>
    <button class="item-download-btn" id="dl_${id}" disabled>Download</button>
  `;

  imageList.appendChild(li);
}


// ==========================================
// 4. 큐 프로세싱 및 캔버스 이미지 처리 (핵심)
// ==========================================

async function processQueue() {
  // 동시성 제한 확인
  if (activeTasks >= MAX_CONCURRENCY || taskQueue.length === 0) {
    return;
  }

  const task = taskQueue.shift();
  activeTasks++;

  try {
    await processImageTask(task);
  } catch (err) {
    console.error('Image processing failed:', err);
    // 에러 발생 시 UI 표시
    const progBar = document.getElementById(`prog_${task.id}`);
    if (progBar) {
      progBar.style.background = 'var(--danger-color)';
      progBar.style.width = '100%';
    }
  } finally {
    activeTasks--;
    processedImagesCount++;
    processedCountSpan.textContent = processedImagesCount;
    updateDownloadAllBtnState();
    
    // 다음 태스크 실행
    processQueue();
  }
}

async function processImageTask(task) {
  return new Promise((resolve, reject) => {
    const { id, file } = task;
    const reader = new FileReader();

    // 1. 파일 읽기 시작 (가짜 진행률 30%)
    updateProgress(id, 30);

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 2. 이미지 로드 완료 (가짜 진행률 60%)
        updateProgress(id, 60);
        
        try {
          // 3. 캔버스 로직 실행
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 목표 비율 파악
          const targetRatioValue = getTargetRatio();
          const mode = document.querySelector('input[name="mode"]:checked').value;
          
          const origW = img.width;
          const origH = img.height;
          const origRatio = origW / origH;
          
          let finalW, finalH;
          let drawX = 0, drawY = 0, drawW = 0, drawH = 0;

          if (mode === 'padding') {
            // 여백(Padding) 모드
            if (origRatio > targetRatioValue) {
              finalW = origW;
              finalH = Math.round(origW / targetRatioValue);
            } else {
              finalH = origH;
              finalW = Math.round(origH * targetRatioValue);
            }
            
            canvas.width = finalW;
            canvas.height = finalH;
            
            // 배경색 칠하기
            ctx.fillStyle = paddingColorInput.value;
            ctx.fillRect(0, 0, finalW, finalH);
            
            // 원본 이미지 중앙에 그리기
            drawX = (finalW - origW) / 2;
            drawY = (finalH - origH) / 2;
            drawW = origW;
            drawH = origH;
            
          } else {
            // 크롭(Crop) 모드
            if (origRatio > targetRatioValue) {
              finalH = origH;
              finalW = Math.round(origH * targetRatioValue);
            } else {
              finalW = origW;
              finalH = Math.round(origW / targetRatioValue);
            }
            
            canvas.width = finalW;
            canvas.height = finalH;
            
            // 이미지 중앙 부분을 잘라서 그리기
            drawW = finalW;
            drawH = finalH;
            
            // 원본 이미지에서 어디를 자를지 계산
            let sx = 0, sy = 0, sw = origW, sh = origH;
            
            if (origRatio > targetRatioValue) {
              sw = origH * targetRatioValue;
              sx = (origW - sw) / 2;
            } else {
              sh = origW / targetRatioValue;
              sy = (origH - sh) / 2;
            }
            
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH);
          }

          if (mode === 'padding') {
             ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }

          // 4. 결과물 Blob 변환 및 저장 (진행률 100%)
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Canvas to Blob failed'));
            
            const thumbUrl = URL.createObjectURL(blob);
            document.getElementById(`thumb_${id}`).src = thumbUrl;
            
            processedFilesMap.set(id, {
              name: `resized_${file.name}`,
              blob: blob
            });
            
            updateProgress(id, 100);
            
            // 다운로드 버튼 활성화
            const dlBtn = document.getElementById(`dl_${id}`);
            dlBtn.disabled = false;
            dlBtn.addEventListener('click', () => {
              saveAs(blob, `resized_${file.name}`);
            });
            
            resolve();
          }, file.type, 0.9);

        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function getTargetRatio() {
  const selected = document.querySelector('input[name="ratio"]:checked').value;
  if (selected === 'custom') {
    const w = parseFloat(customWidthInput.value) || 1;
    const h = parseFloat(customHeightInput.value) || 1;
    return w / h;
  }
  
  const [w, h] = selected.split(':').map(Number);
  return w / h;
}

function updateProgress(id, percent) {
  const bar = document.getElementById(`prog_${id}`);
  if (bar) {
    bar.style.width = `${percent}%`;
    if (percent === 100) {
      bar.classList.add('done');
    }
  }
}

// ==========================================
// 5. ZIP 일괄 다운로드 로직
// ==========================================

function updateDownloadAllBtnState() {
  if (totalImagesToProcess > 0 && processedImagesCount === totalImagesToProcess) {
    downloadAllBtn.disabled = false;
  } else {
    downloadAllBtn.disabled = true;
  }
}

downloadAllBtn.addEventListener('click', async () => {
  if (processedFilesMap.size === 0) return;
  
  downloadAllBtn.disabled = true;
  const originalText = downloadAllBtn.innerHTML;
  downloadAllBtn.innerHTML = 'Zipping...';
  
  try {
    const zip = new JSZip();
    
    // 처리된 모든 파일을 ZIP에 추가
    for (const [id, data] of processedFilesMap.entries()) {
      zip.file(data.name, data.blob);
    }
    
    // 압축 파일 생성
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // 다운로드 트리거
    saveAs(zipBlob, 'resized_images.zip');
    
  } catch (err) {
    console.error('ZIP generation failed:', err);
    alert('ZIP 파일 생성 중 오류가 발생했습니다.');
  } finally {
    downloadAllBtn.innerHTML = originalText;
    downloadAllBtn.disabled = false;
  }
});
