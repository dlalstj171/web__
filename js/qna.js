import React, { useState, useEffect } from "react";

// ==========================================
// [CSS 디자인 영역] 여기서 색상/디자인을 바꿀 수 있습니다.
// ==========================================
const styles = {
  // 메인 테마 색상 (네이비)
  mainColor: "#2c3e50", 
  
  // 전체 배경
  container: {
    width: "100%",
    minHeight: "100vh",
    backgroundColor: "#f4f6f8",
    fontFamily: "'Noto Sans KR', sans-serif"
  },
  // 상단 헤더 (HTML의 <header> 스타일)
  header: {
    backgroundColor: "#2c3e50", // 메인 컬러와 동일하게
    color: "white",
    padding: "20px 0",
    textAlign: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    marginBottom: "30px"
  },
  // 버튼 스타일 (HTML의 <button> 스타일)
  button: {
    backgroundColor: "#2c3e50", // 촌스러운 파랑 대신 네이비 적용
    color: "white",
    padding: "12px 25px",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "1rem",
    transition: "background 0.3s"
  },
  // 박스 스타일
  box: {
    backgroundColor: "white",
    padding: "25px",
    borderRadius: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    marginBottom: "20px"
  }
};

const API_BASE = "http://localhost:3000";

const Qna = () => {
  // --- [JS 로직] ---
  const [list, setList] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState("익명");
  const [inputs, setInputs] = useState({
    region: "지역 선택",
    category: "분류 선택",
    title: "",
    content: ""
  });

  const regions = ["서울", "경기", "인천", "강원", "충청", "대전", "세종", "전라", "광주", "경상", "대구", "부산", "울산", "제주"];

  useEffect(() => {
    fetchList();
    fetchUsers();
  }, []);

  const fetchList = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qna`);
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs({ ...inputs, [name]: value });
  };

  const handleSubmit = async () => {
    if (inputs.region === "지역 선택" || inputs.category === "분류 선택" || !inputs.title || !inputs.content) {
      alert("모든 항목을 입력해주세요.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/qna`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputs, writer: currentUser })
      });
      if (res.ok) {
        alert("등록되었습니다!");
        setInputs({ region: "지역 선택", category: "분류 선택", title: "", content: "" });
        fetchList();
      }
    } catch (err) { alert("서버 연결 실패"); }
  };

  // --- [HTML 화면 영역] (return 안쪽이 HTML입니다) ---
  return (
    <div style={styles.container}>
      
      {/* 1. 상단 헤더바 */}
      <header style={styles.header}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>여행 정보 공유 시스템</h1>
      </header>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 20px" }}>
        
        {/* 2. 사용자 선택 박스 (MySQL 연동) */}
        <div style={{ ...styles.box, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 5px 0", fontSize: "1.2rem", color: "#333" }}>Q&A 질문 등록</h2>
            <span style={{ fontSize: "0.9rem", color: "#666" }}>궁금한 점을 자유롭게 질문하세요.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: "bold", color: styles.mainColor }}>👤 작성자:</span>
            <select 
              value={currentUser} 
              onChange={(e) => setCurrentUser(e.target.value)}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            >
              <option value="익명">익명</option>
              {users.map((u) => (
                <option key={u.id} value={u.nickname}>{u.nickname}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. 입력 폼 */}
        <div style={styles.box}>
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <select name="region" value={inputs.region} onChange={handleChange} style={inputStyle}>
              <option value="지역 선택">지역 선택</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select name="category" value={inputs.category} onChange={handleChange} style={inputStyle}>
              <option value="분류 선택">분류 선택</option>
              <option value="관광지">관광지</option>
              <option value="맛집">맛집</option>
              <option value="교통">교통</option>
              <option value="기타">기타</option>
            </select>
          </div>
          
          <input 
            type="text" name="title" placeholder="제목" 
            value={inputs.title} onChange={handleChange} 
            style={{ ...inputStyle, width: "96%" }} 
          />
          <textarea 
            name="content" placeholder="내용을 입력하세요" 
            value={inputs.content} onChange={handleChange} 
            style={{ ...inputStyle, width: "96%", height: "120px", resize: "none" }} 
          />
          
          <div style={{ textAlign: "right", marginTop: "10px" }}>
            {/* 여기가 그 파란색 버튼이었던 곳입니다 -> 네이비로 변경됨 */}
            <button onClick={handleSubmit} style={styles.button}>
              질문 등록하기
            </button>
          </div>
        </div>

        {/* 4. 게시글 목록 */}
        <div style={styles.box}>
          <h3 style={{ borderBottom: `2px solid ${styles.mainColor}`, paddingBottom: "10px", marginTop: 0 }}>
            최근 목록
          </h3>
          {list.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>질문이 없습니다.</div>
          ) : (
            list.map((item, index) => (
              <div key={index} style={{ borderBottom: "1px solid #eee", padding: "15px 0" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "5px", fontSize: "0.85rem" }}>
                  <span style={badgeStyle}>{item.region}</span>
                  <span style={badgeStyle}>{item.category}</span>
                  <span style={{ fontWeight: "bold", color: styles.mainColor }}>🖊 {item.writer}</span>
                  <span style={{ marginLeft: "auto", color: "#aaa" }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#333" }}>{item.title}</div>
                <div style={{ color: "#555", marginTop: "5px" }}>{item.content}</div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

// [보조 스타일]
const inputStyle = { padding: "12px", border: "1px solid #ddd", borderRadius: "5px", marginBottom: "10px", fontSize: "1rem", flex: 1 };
const badgeStyle = { backgroundColor: "#f1f3f5", color: "#495057", padding: "4px 8px", borderRadius: "4px" };

export default Qna;