// js/Tensorflow.js - 여행 후기 사진 분석 AI 모듈

let net; // AI 모델을 담을 전역 변수

// 1. AI 모델 로드 함수
async function loadAIModel() {
    const resultDiv = document.getElementById('aiResult');
    if (resultDiv) resultDiv.innerText = "AI 모델을 불러오는 중입니다...";

    try {
        // 구글 MobileNet 모델 로드
        net = await mobilenet.load();
        console.log("TensorFlow.js MobileNet 모델 로딩 완료!");
        if (resultDiv) resultDiv.innerText = "AI 모델 준비 완료! 사진을 선택하세요.";
    } catch (e) {
        console.error("모델 로딩 실패:", e);
        if (resultDiv) resultDiv.innerText = "모델 로딩 실패 (네트워크 확인 필요)";
    }
}

// 2. 한글 번역 사전
const translationMap = {
    "pier": "부두 / 잔교", "dock": "선착장", "seashore": "해변가", "coast": "해안",
    "valley": "계곡", "alp": "높은 산맥", "volcano": "화산", "lakeside": "호숫가",
    "lighthouse": "등대", "castle": "성 / 성곽", "palace": "궁전", "restaurant": "식당",
    "coffee mug": "머그컵 / 커피", "pizza": "피자", "bullet train": "고속 열차"
    // ... 필요한 단어들을 계속 추가할 수 있습니다.
};

// 3. 번역 함수
function translateToKorean(englishName) {
    const words = englishName.split(',').map(w => w.trim().toLowerCase());
    for (let word of words) {
        if (translationMap[word]) return translationMap[word];
    }
    return englishName;
}

// 4. 이미지 분석 실행 함수
async function classifyImage(imgElement) {
    const resultDiv = document.getElementById('aiResult');
    if (!resultDiv) return;

    resultDiv.innerText = " AI가 열심히 사진을 분석 중입니다...";

    try {
        if (!net) {
            resultDiv.innerText = "모델이 로딩되지 않았습니다.";
            return;
        }

        const result = await net.classify(imgElement);
        let resultText = " AI 분석 결과:\n";

        result.forEach((item, index) => {
            const koreanName = translateToKorean(item.className);
            const prob = (item.probability * 100).toFixed(1);
            if (index === 0) {
                resultText += ` [${koreanName}] - ${prob}%\n`;
            } else {
                resultText += `  - ${koreanName} (${prob}%)\n`;
            }
        });
        resultDiv.innerText = resultText;
    } catch (error) {
        console.error("AI 분석 오류:", error);
        resultDiv.innerText = "분석 중 오류가 발생했습니다.";
    }
}

// 페이지 로드 시 모델 자동 로드 실행
loadAIModel();