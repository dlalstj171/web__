// 맨 위로 가기 버튼 기능만 남긴 버전
document.addEventListener("DOMContentLoaded", () => {
  const btnTop = document.getElementById("btnTop");
  if (!btnTop) return;  // 버튼 없으면 아무 것도 안 함

  btnTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"   // 부드럽게 스크롤
    });
  });
});
