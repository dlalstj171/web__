// js/review.js

// ============================
// 공통: 백엔드 API 주소
// ============================
const API_BASE = "http://localhost:3000";

console.log("✅ review.js 로드됨");

// ============================
// 1) 후기 입력 페이지 (review.html)
// ============================
(function setupReviewWritePage() {
  const submitBtn = document.getElementById("submitReview");
  if (!submitBtn) return; // 이 페이지가 아니면 패스

  let selectedStar = 0;  // 클릭으로 최종 선택한 별점(1~5)

  const starBox   = document.querySelector(".star-box");
  const starElems = document.querySelectorAll(".star");

  // 별을 rating만큼 칠해주는 함수
  function paintStars(rating) {
    starElems.forEach(star => {
      const value = Number(star.dataset.value); // 1~5
      star.classList.toggle("active", value <= rating);
    });
  }

  // 마우스를 별 위에 올렸을 때: 그 별까지 미리보기
  starElems.forEach(star => {
    star.addEventListener("mouseenter", () => {
      const hoverValue = Number(star.dataset.value);
      paintStars(hoverValue);
    });

    // 클릭하면 선택값 확정 + 다시 칠하기
    star.addEventListener("click", () => {
      selectedStar = Number(star.dataset.value); // 1~5
      paintStars(selectedStar);
      console.log("⭐ 선택한 별점:", selectedStar);
    });
  });

  // 별 영역 밖으로 마우스 나가면, 마지막 선택값 기준으로 다시 칠하기
  if (starBox) {
    starBox.addEventListener("mouseleave", () => {
      paintStars(selectedStar);
    });
  }

  // ------------------------------------
  // 🔹 후기 글자 수 카운터 (1번 기능)
  // ------------------------------------
   // ------------------------------------
  // 🔹 후기 글자 수 카운터
  // ------------------------------------
  const textarea    = document.getElementById("reviewInput");
  const charCountEl = document.getElementById("charCount");
  const metaEl      = document.querySelector(".textarea-meta");
  const MAX_LEN     = 300;

  if (textarea && charCountEl) {
    const updateCount = () => {
      const len = textarea.value.length;
      charCountEl.textContent = len;

      if (metaEl) {
        if (len > MAX_LEN * 0.8) {
          metaEl.classList.add("warn");
        } else {
          metaEl.classList.remove("warn");
        }
      }
    };

    textarea.addEventListener("input", updateCount);
    // 처음 로드 시도 0/300 한 번 반영
    updateCount();
  } else {
    console.log("⚠ reviewInput 또는 charCount를 찾지 못함");
  }

  // "작성 완료" 버튼 → 서버에 POST
  submitBtn.addEventListener("click", async () => {
    const region = document.getElementById("regionSelect").value;
    const text   = document.getElementById("reviewInput").value.trim();

    if (!text || region === "지역 선택" || !selectedStar) {
      alert("지역 / 별점 / 내용을 모두 입력하세요!");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: region,
          rating: selectedStar, // 1~5
          content: text
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("❌ 리뷰 저장 실패:", errData);
        alert(errData.message || "리뷰 저장 중 오류가 발생했습니다.");
        return;
      }

      alert("후기가 등록되었습니다!");
      // 작성 후 목록 페이지로 이동
      location.href = "review_list.html";
    } catch (err) {
      console.error("❌ 서버 요청 실패:", err);
      alert("서버에 연결할 수 없습니다. (server.js가 켜져 있는지 확인해주세요)");
    }
  });
})();


// ============================
// 2) 후기 목록 페이지 (review_list.html)
// ============================
(function setupReviewListPage() {
  const listEl = document.getElementById("reviewList");
  if (!listEl) return; // 이 페이지가 아니면 패스

  const filterSelect = document.getElementById("filterRegion");

  async function loadAndRenderReviews() {
    listEl.innerHTML = "<p>후기를 불러오는 중입니다...</p>";

    try {
      const url = new URL(`${API_BASE}/api/reviews`);
      if (filterSelect && filterSelect.value) {
        url.searchParams.set("region", filterSelect.value);
      }

      const res = await fetch(url);
      const reviews = await res.json();

      if (!Array.isArray(reviews) || reviews.length === 0) {
        listEl.innerHTML = "<p>등록된 후기가 없습니다.</p>";
        return;
      }

      listEl.innerHTML = "";

      reviews.forEach(r => {
        const rawRating = Number(r.rating) || 0;
        const starCount = Math.min(Math.max(rawRating, 0), 5); // 0~5로 제한
        const dateStr = r.created_at
          ? new Date(r.created_at).toLocaleString("ko-KR")
          : "";

        listEl.innerHTML += `
          <div class="review-card">
            <div class="stars">
              ${"★".repeat(starCount)}${"☆".repeat(5 - starCount)}
            </div>
            <div class="review-top">
              <div class="review-region">${r.region}</div>
              <div class="review-date">${dateStr}</div>
            </div>
            <div class="review-content">${r.content}</div>
          </div>
        `;
      });
    } catch (err) {
      console.error("❌ 리뷰 목록 불러오기 실패:", err);
      listEl.innerHTML = "<p>리뷰를 불러오는 중 오류가 발생했습니다.</p>";
    }
  }

  // 페이지 로드시 자동 로딩
  loadAndRenderReviews();

  // 필터 변경 시 다시 로딩
  if (filterSelect) {
    filterSelect.addEventListener("change", loadAndRenderReviews);
  }
})();
