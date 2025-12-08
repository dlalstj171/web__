const API_BASE = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  const regionSelect = document.getElementById("qnaRegion");
  const categorySelect = document.getElementById("qnaCategory");
  const titleInput = document.getElementById("qnaTitle");
  const contentInput = document.getElementById("qnaContent");
  const charCountEl = document.getElementById("qnaCharCount");
  const submitBtn = document.getElementById("qnaSubmit");
  const listEl = document.getElementById("qnaList");

  if (!submitBtn) {
    return;
  }

  // 글자 수 카운터
  if (contentInput && charCountEl) {
    const updateCount = () => {
      const len = contentInput.value.length;
      charCountEl.textContent = len;
    };
    contentInput.addEventListener("input", updateCount);
    updateCount();
  }

  // Q&A 등록
  submitBtn.addEventListener("click", async () => {
    const region = regionSelect.value;
    const category = categorySelect.value;
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (region === "지역 선택" || !region ||
        category === "분류 선택" || !category ||
        !title || !content) {
      alert("지역, 분류, 제목, 내용을 모두 입력해주세요.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/qna`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, category, title, content })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || "Q&A 저장 중 오류가 발생했습니다.");
        return;
      }

      alert("질문이 등록되었습니다.");

      // 입력 초기화
      regionSelect.value = "지역 선택";
      categorySelect.value = "분류 선택";
      titleInput.value = "";
      contentInput.value = "";
      if (charCountEl) charCountEl.textContent = "0";

      // 목록 갱신
      loadQnaList();
    } catch (err) {
      console.error("Q&A 등록 실패:", err);
      alert("서버에 연결할 수 없습니다.");
    }
  });

  // 최근 Q&A 목록 불러오기
  async function loadQnaList() {
    if (!listEl) return;

    listEl.innerHTML = "<p>Q&A를 불러오는 중입니다...</p>";

    try {
      const res = await fetch(`${API_BASE}/api/qna`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        listEl.innerHTML = "<p>등록된 Q&A가 아직 없습니다.</p>";
        return;
      }

      listEl.innerHTML = "";

      data.slice(0, 5).forEach(q => {
        const dateStr = q.created_at
          ? new Date(q.created_at).toLocaleString("ko-KR")
          : "";

        const div = document.createElement("div");
        div.className = "qna-item";
        div.innerHTML = `
          <div class="qna-item-title">${q.title}</div>
          <div class="qna-item-meta">
            [${q.region}] ${q.category} · ${dateStr}
          </div>
          <div class="qna-item-content">${q.content}</div>
        `;
        listEl.appendChild(div);
      });
    } catch (err) {
      console.error("Q&A 목록 로딩 실패:", err);
      listEl.innerHTML = "<p>Q&A 목록을 불러오는 중 오류가 발생했습니다.</p>";
    }
  }

  loadQnaList();
});
