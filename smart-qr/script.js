document.addEventListener("DOMContentLoaded", () => {
    // === DOM 요소 가져오기 ===
    const urlInput = document.getElementById('url-input');
    const generateBtn = document.getElementById('generate-btn');
    const inputWrapper = document.getElementById('input-wrapper');
    const qrWrapper = document.getElementById('qr-wrapper');
    const qrImage = document.getElementById('qr-image');
    const qrCard = document.querySelector('.qr-card');
    const errorMessage = document.getElementById('error-message');

    // 다운로드를 위해 현재 생성된 이미지 src를 저장해둘 변수
    let currentQrSrc = null;

    // === QR 코드 생성 및 화면 전환 함수 ===
    const generateQR = async () => {
        const url = urlInput.value.trim();
        
        // 기존 에러 메시지 초기화
        errorMessage.textContent = "";

        // 입력값 검증: 빈 값일 경우 처리
        if (!url) {
            errorMessage.textContent = "URL을 입력해주세요.";
            return;
        }

        try {
            // QRCode.toDataURL()를 사용하여 URL 텍스트를 QR 이미지 데이터(Base64)로 변환
            // 옵션: jpg 형식, 퀄리티 1(최고), 약간의 여백(margin), 크기 300px
            const qrDataUrl = await QRCode.toDataURL(url, {
                type: 'image/jpeg',
                quality: 1,
                margin: 2,
                width: 300
            });

            // 1. 생성된 이미지 코드를 img 태그에 삽입
            qrImage.src = qrDataUrl;
            currentQrSrc = qrDataUrl;

            // 2. 입력창을 하단으로 이동시키는 클래스 교체
            inputWrapper.classList.remove('center-mode');
            inputWrapper.classList.add('bottom-mode');
            
            // 3. 약간의 딜레이 후 정중앙에 QR 코드가 부드럽게 나타나도록 처리
            setTimeout(() => {
                qrWrapper.classList.remove('hidden');
            }, 300);

        } catch (err) {
            console.error(err);
            errorMessage.textContent = "QR코드 생성 중 오류가 발생했습니다. (내용이 너무 길거나 이상이 있을 수 있습니다.)";
        }
    };

    // === 이벤트 리스너 바인딩 ===
    // 확인 버튼 클릭 시 QR 생성
    generateBtn.addEventListener('click', generateQR);

    // 입력창에서 엔터키 입력 시 QR 생성 (편의성 부여)
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            generateQR();
        }
    });

    // === 다운로드 로직 ===
    // QR 이미지 카드를 클릭하면 저장되도록 구현
    qrCard.addEventListener('click', () => {
        if (!currentQrSrc) return;

        // 보이지 않는 <a> 태그를 생성하여 브라우저의 다운로드 기능을 트리거합니다.
        const link = document.createElement('a');
        link.href = currentQrSrc;
        link.download = 'smart_qr.jpg'; // 요청하신 jpg 확장자로 지정
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // === 다이나믹 그라데이션 오버레이용 마우스 커서 추적 로직 ===
    document.addEventListener('mousemove', (e) => {
        // 화면 전체 너비/높이 대비 현재 마우스의 위치를 퍼센트(%)로 계산
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        
        // 계산된 위치를 CSS의 변수에 실시간으로 전달
        document.documentElement.style.setProperty('--mouse-x', `${x}%`);
        document.documentElement.style.setProperty('--mouse-y', `${y}%`);
    });
});
