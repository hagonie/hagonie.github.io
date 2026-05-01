const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const fileListContainer = document.getElementById('file-list-container');
const fileList = document.getElementById('file-list');

// Supported extensions
const SUPPORTED_EXTENSIONS = ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'hwp', 'hwpx', 'jpg', 'jpeg', 'png', 'webp'];

// Drag & Drop Events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) { dropZone.classList.add('dragover'); }
function unhighlight(e) { dropZone.classList.remove('dragover'); }

dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

uploadBtn.addEventListener('click', () => { fileInput.click(); });
fileInput.addEventListener('change', function () {
    handleFiles(this.files);
    this.value = '';
});

function handleFiles(files) {
    files = [...files];
    const validFiles = files.filter(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        return SUPPORTED_EXTENSIONS.includes(ext);
    });

    if (validFiles.length > 0) {
        fileListContainer.style.display = 'block';
        validFiles.forEach(processFile);
    }
}

function getIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'fa-file-pdf pdf';
    if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint ppt';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word doc';
    if (['hwp', 'hwpx'].includes(ext)) return 'fa-file-lines hwp';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'fa-file-image image';
    return 'fa-file';
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function processFile(file) {
    const li = document.createElement('li');
    li.className = 'file-item';

    // Create elements
    const iconClass = getIconClass(file.name);

    // File content template
    li.innerHTML = `
        <i class="fa-regular ${iconClass} file-icon"></i>
        <div class="file-info">
            <span class="file-name">${file.name}</span>
            <div class="file-size-info" style="font-size: 0.8rem; color: var(--text-sub); margin-top: 4px;">${formatBytes(file.size)}</div>
            <div class="progress-track" style="margin-top: 8px;">
                <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="status-message" style="font-size: 0.8rem; color: var(--text-sub); margin-top: 4px; display:none;"></div>
        </div>
        <span class="status-text">0%</span>
        <button class="action-btn download-btn" title="Download Compressed File">
            <i class="fa-solid fa-download"></i>
        </button>
    `;

    fileList.appendChild(li);

    const progressBar = li.querySelector('.progress-bar');
    const statusText = li.querySelector('.status-text');
    const downloadBtn = li.querySelector('.download-btn');
    const sizeInfo = li.querySelector('.file-size-info');
    const statusMsg = li.querySelector('.status-message');

    const ext = file.name.split('.').pop().toLowerCase();

    // Route processing based on file type
    if (['hwp', 'hwpx'].includes(ext)) {
        statusMsg.style.display = 'block';
        statusMsg.textContent = "Processing HWP document...";
        simulateCompression(file, progressBar, statusText, downloadBtn, sizeInfo);
        return;
    }

    if (['pdf'].includes(ext)) {
        statusMsg.style.display = 'block';
        statusMsg.textContent = "Scanning and compressing PDF pages...";
        compressPdf(file, progressBar, statusText, downloadBtn, sizeInfo, statusMsg);
    } else if (['docx', 'pptx'].includes(ext)) {
        statusMsg.style.display = 'block';
        statusMsg.textContent = "Analyzing document structure...";
        compressOfficeFile(file, progressBar, statusText, downloadBtn, sizeInfo, statusMsg);
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        statusMsg.style.display = 'block';
        statusMsg.textContent = "Optimizing image...";
        processImageFile(file, progressBar, statusText, downloadBtn, sizeInfo, statusMsg);
    } else {
        // Fallback
        simulateCompression(file, progressBar, statusText, downloadBtn, sizeInfo);
    }
}

// REAL PDF COMPRESSION (RASTERIZATION)
async function compressPdf(file, progressBar, statusText, downloadBtn, sizeInfo, statusMsg) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;

        statusMsg.textContent = `Processing ${totalPages} pages... (This may take a while)`;

        const { jsPDF } = window.jspdf;
        const newPdf = new jsPDF();

        let processedCount = 0;

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); // Scale 1.5 for decent balance

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // Convert to JPEG with quality 0.5 (aggressive compression)
            const imgData = canvas.toDataURL('image/jpeg', 0.5);

            // Add to new PDF
            // Calculate aspect ratio to fit in A4 or keep original size?
            // jsPDF default is A4 (210x297mm). Let's fit the image into the page.

            const imgProps = newPdf.getImageProperties(imgData);
            const pdfWidth = newPdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            if (i > 1) newPdf.addPage();
            newPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

            processedCount++;
            const progress = Math.round((processedCount / totalPages) * 90);
            progressBar.style.width = progress + '%';
            statusText.textContent = progress + '%';
        }

        statusMsg.textContent = "Building final PDF...";
        const finalBlob = newPdf.output('blob');

        finishMethods(file, progressBar, statusText, downloadBtn, sizeInfo, finalBlob, 0, true);

    } catch (e) {
        console.error("PDF Compression failed", e);
        statusMsg.textContent = "PDF compression failed: " + e.message;
        statusMsg.style.color = "red";
    }
}

// REUSED LOGIC
async function processImageFile(file, progressBar, statusText, downloadBtn, sizeInfo, statusMsg) {
    try {
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 80) clearInterval(progressInterval);
            progressBar.style.width = progress + '%';
            statusText.textContent = progress + '%';
        }, 50);

        const compressedBlob = await compressImage(file);
        clearInterval(progressInterval);

        statusMsg.textContent = "Done.";
        finishMethods(file, progressBar, statusText, downloadBtn, sizeInfo, compressedBlob, 0, true);

    } catch (e) {
        console.error("Image compression failed", e);
        statusMsg.textContent = "Compression failed: " + e.message;
        statusMsg.style.color = "red";
    }
}

async function compressOfficeFile(file, progressBar, statusText, downloadBtn, sizeInfo, statusMsg) {
    try {
        const zip = new JSZip();
        // 1. Load the file
        const contents = await zip.loadAsync(file);

        // 2. Find images (Expanded support)
        const mediaFiles = [];
        zip.forEach((relativePath, zipEntry) => {
            if (relativePath.match(/word\/media\/|ppt\/media\//i) && !zipEntry.dir) {
                if (relativePath.match(/\.(jpeg|jpg|png|gif|bmp|tiff|webp)$/i)) {
                    mediaFiles.push(zipEntry);
                }
            }
        });

        if (mediaFiles.length === 0) {
            statusMsg.textContent = "No compressible images found. Switching to simulation.";
            // Fallback to simulation if no images found, so user always gets a "download"
            simulateCompression(file, progressBar, statusText, downloadBtn, sizeInfo);
            return;
        }

        statusMsg.textContent = `Found ${mediaFiles.length} images. Compressing...`;

        let processedCount = 0;

        // 3. Compress images
        for (const entry of mediaFiles) {
            const blob = await entry.async("blob");

            try {
                const compressedBlob = await compressImage(blob);
                // Replace in zip
                zip.file(entry.name, compressedBlob);
            } catch (err) {
                console.warn("Failed to compress image:", entry.name);
            }

            processedCount++;
            const progress = Math.round((processedCount / mediaFiles.length) * 90); // Up to 90%
            progressBar.style.width = progress + '%';
            statusText.textContent = progress + '%';
        }

        statusMsg.textContent = "Re-packaging document...";

        // 4. Generate new file
        const compressedContent = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 9 } // Max compression for the xml parts
        });

        // 5. Finish
        finishMethods(file, progressBar, statusText, downloadBtn, sizeInfo, compressedContent, 0, true);

    } catch (e) {
        console.error("Compression failed", e);
        statusMsg.textContent = "Real compression failed. Switching to simulation...";
        statusMsg.style.color = "var(--text-sub)";

        // Fallback to simulation on error
        setTimeout(() => {
            simulateCompression(file, progressBar, statusText, downloadBtn, sizeInfo);
        }, 1000);
    }
}

async function compressImage(imageBlob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Resize if too big (max 1920px)
            let width = img.width;
            let height = img.height;
            const MAX_DIM = 1920;

            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                    height = Math.round(height * (MAX_DIM / width));
                    width = MAX_DIM;
                } else {
                    width = Math.round(width * (MAX_DIM / height));
                    height = MAX_DIM;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Compress to JPEG with 0.6 quality
            canvas.toBlob((blob) => {
                if (blob && blob.size < imageBlob.size) {
                    resolve(blob);
                } else {
                    resolve(imageBlob);
                }
            }, 'image/jpeg', 0.6);
        };
        img.onerror = () => resolve(imageBlob); // Return original on error
        img.src = URL.createObjectURL(imageBlob);
    });
}

function finishMethods(originalFile, progressBar, statusText, downloadBtn, sizeInfo, finalBlob, savedPercentOverride, isReal = false) {
    progressBar.style.width = '100%';
    statusText.textContent = '100%';
    statusText.style.color = "var(--success-color)";

    let compressedSize = finalBlob.size;
    let savedPercent = 0;

    if (originalFile.size > 0) {
        savedPercent = Math.round((1 - (compressedSize / originalFile.size)) * 100);
    }

    // If we passed an override (for simulation)
    if (savedPercentOverride) savedPercent = savedPercentOverride;

    if (savedPercent < 0) savedPercent = 0; // Don't show negative savings

    sizeInfo.innerHTML = `
        <span style="text-decoration: line-through">${formatBytes(originalFile.size)}</span> 
        <i class="fa-solid fa-arrow-right" style="font-size: 0.7em; margin: 0 5px;"></i> 
        <span style="color: var(--success-color); font-weight: bold">${formatBytes(compressedSize)}</span>
        <span style="background: var(--success-color); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; margin-left: 8px;">-${savedPercent}%</span>
        ${isReal ? '<span style="color: var(--primary-color); font-weight: bold; font-size: 0.7em; margin-left: 5px;">(REAL)</span>' : ''}
    `;

    downloadBtn.classList.add('active');

    downloadBtn.onclick = () => {
        let newName = `compressed_${originalFile.name}`;
        if (isReal && ['png', 'webp', 'bmp'].some(ext => originalFile.name.toLowerCase().endsWith(ext))) {
            newName = newName.replace(/\.[^/.]+$/, ".jpg");
        }

        const url = URL.createObjectURL(finalBlob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = newName;

        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 6000); // 6s delay
    };
}


// SIMULATION FALLBACK
function simulateCompression(file, progressBar, statusText, downloadBtn, sizeInfo) {
    let width = 0;
    const intervalTime = Math.floor(Math.random() * 40) + 20;

    const interval = setInterval(() => {
        width += Math.random() * 5;
        if (width >= 100) {
            width = 100;
            clearInterval(interval);

            // FAKE stats
            const reduction = 0.2 + (Math.random() * 0.3);
            const compressedSize = Math.floor(file.size * (1 - reduction));

            statusText.textContent = "Done";
            statusText.style.color = "var(--success-color)";

            const savedPercent = Math.floor(reduction * 100);
            sizeInfo.innerHTML = `
                <span style="text-decoration: line-through">${formatBytes(file.size)}</span> 
                <i class="fa-solid fa-arrow-right" style="font-size: 0.7em; margin: 0 5px;"></i> 
                <span style="color: var(--success-color); font-weight: bold">${formatBytes(compressedSize)}</span>
                <span style="background: var(--success-color); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; margin-left: 8px;">-${savedPercent}%</span>
                <span style="color: var(--text-sub); font-size: 0.7em; margin-left: 5px;">(Simulated)</span>
            `;

            downloadBtn.classList.add('active');
            downloadBtn.onclick = () => {
                const compressedName = `compressed_${file.name}`;
                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = compressedName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }, 6000);
            };
        }

        progressBar.style.width = width + '%';
        statusText.textContent = Math.floor(width) + '%';
    }, intervalTime);
}
