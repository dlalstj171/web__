// review.js (최종 수정본)
const API_BASE = "http://localhost:3000";

// ============================
// 1) 후기 작성 페이지 로직
// ============================
(function setupReviewWritePage() {
  const submitBtn = document.getElementById("submitReview");
  if (!submitBtn) return; // 작성 페이지가 아니면 중단

  let selectedStar = 0;
  const starElems = document.querySelectorAll(".star");

  // 별점 클릭 이벤트
  starElems.forEach(star => {
    star.addEventListener("click", () => {
      selectedStar = Number(star.dataset.value);
      // 별 색칠하기
      starElems.forEach(s => {
        s.classList.toggle("active", Number(s.dataset.value) <= selectedStar);
      });
    });
  });

  // "작성 완료" 버튼 클릭 시
  submitBtn.addEventListener("click", async () => {
    // 1. HTML에서 값 가져오기
    const region   = document.getElementById("regionSelect").value;
    const text     = document.getElementById("reviewInput").value.trim();
    const writerId = document.getElementById("writerId").value.trim(); // 추가됨
    const password = document.getElementById("password").value.trim(); // 추가됨

    // 2. 입력 확인
    if (region === "지역 선택" || !selectedStar || !text) {
      alert("지역, 별점, 내용을 모두 입력하세요.");
      return;
    }
    if (!writerId || !password) {
      alert("아이디와 비밀번호를 입력해주세요. (비회원은 자동 가입됩니다)");
      return;
    }

    // 3. 서버로 전송
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: region,
          rating: selectedStar,
          content: text,
          writerId: writerId, 
          password: password  
        })
      });

      const data = await res.json();

      if (res.ok) {
        alert("후기가 등록되었습니다!");
        location.href = "review_list.html"; // 목록 페이지로 이동
      } else {
        alert(data.message || "오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 연결 실패!");
    }
  });
})();

// ============================
// 2) 후기 목록 페이지 로직
// ============================
(function setupReviewListPage() {
  const listEl = document.getElementById("reviewList");
  if (!listEl) return; // 목록 페이지가 아니면 중단

  const filterSelect = document.getElementById("filterRegion");

  async function loadReviews() {
    listEl.innerHTML = "<p>로딩 중...</p>";
    try {
      // 필터 적용
      const url = new URL(`${API_BASE}/api/reviews`);
      if (filterSelect && filterSelect.value) {
        url.searchParams.set("region", filterSelect.value);
      }

      const res = await fetch(url);
      const reviews = await res.json();

      listEl.innerHTML = "";
      
      if (reviews.length === 0) {
        listEl.innerHTML = "<p>등록된 후기가 없습니다.</p>";
        return;
      }

      // 목록 그리기
      reviews.forEach(r => {
        const starCount = r.rating; 
        const stars = "★".repeat(starCount) + "☆".repeat(5 - starCount);
        
        // r.nickname : 서버에서 JOIN으로 가져온 작성자 이름
        listEl.innerHTML += `
          <div class="review-card">
            <div class="stars" style="color: #f39c12;">${stars}</div>
            <div class="review-top">
              <strong>${r.nickname}</strong> 님 
              <span style="color:gray; font-size:0.9em;">(${r.region})</span>
            </div>
            <div class="review-content" style="margin-top:5px;">
              ${r.content}
            </div>
            <div class="date" style="font-size:0.8em; color:#aaa; margin-top:10px;">
              ${new Date(r.created_at).toLocaleString()}
            </div>
          </div>
          <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
        `;
      });
    } catch (err) {
      console.error(err);
      listEl.innerHTML = "<p>불러오기 실패</p>";
    }
  }

  // 초기 로드 및 필터 이벤트 연결
  loadReviews();
  if (filterSelect) {
    filterSelect.addEventListener("change", loadReviews);
  }
})();