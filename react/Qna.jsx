import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:3000"; // 서버 주소

const Qna = () => {
  // 1. 상태(State) 선언
  const [list, setList] = useState([]); // 게시글 목록
  const [users, setUsers] = useState([]); // [NEW] MySQL에서 가져올 유저 목록
  const [currentUser, setCurrentUser] = useState("익명"); //  현재 선택된 사용자(로그인 시뮬레이션)
  
  const [inputs, setInputs] = useState({
    region: "지역 선택",
    category: "분류 선택",
    title: "",
    content: ""
  });

  // 파일 목록 기반 지역 리스트 (가나다순 정렬)
  const regions = [
    "서울", "경기", "인천", 
    "강원", "충청", "대전", "세종",
    "전라", "광주", 
    "경상", "대구", "부산", "울산",
    "제주"
  ];

  // 2. 데이터 불러오기 (Read)
  useEffect(() => {
    fetchList();  // 게시글 불러오기
    fetchUsers(); // [NEW] 유저 목록 불러오기
  }, []);

  // 게시글 목록 가져오기 (MongoDB)
  const fetchList = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qna`);
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("게시글 로드 실패:", err);
    }
  };

  // [NEW] 유저 목록 가져오기 (MySQL)
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("유저 로드 실패:", err);
    }
  };

  // 3. 입력값 변경 처리
  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs({ ...inputs, [name]: value });
  };

  // 4. 등록하기 버튼 클릭 (Create)
  const handleSubmit = async () => {
    // 유효성 검사
    if (inputs.region === "지역 선택" || inputs.category === "분류 선택" || !inputs.title || !inputs.content) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    try {
      // 서버로 보낼 때 'writer'에 현재 선택된 사용자(currentUser)를 담아서 보냄
      const payload = {
        ...inputs,
        writer: currentUser 
      };

      const res = await fetch(`${API_BASE}/api/qna`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(`${currentUser}님, 질문이 등록되었습니다.`); // 알림 메시지도 변경
        // 입력창 비우기
        setInputs({
          region: "지역 선택",
          category: "분류 선택",
          title: "",
          content: ""
        });
        // 목록 다시 불러오기
        fetchList();
      } else {
        alert("등록 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error("등록 실패:", err);
      alert("서버 연결 실패");
    }
  };

  return (
    <div className="qna-container" style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h2>Q&A 게시판</h2>
      <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "20px" }}>
        React(View) + Node.js(Server) + MySQL(User) + MongoDB(Data) 연동 실습
      </p>

      {/* --- [NEW] 사용자 선택 (로그인 시뮬레이션) --- */}
      <div style={{ backgroundColor: "#eef", padding: "15px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #ccd" }}>
        <label style={{ marginRight: "10px", fontWeight: "bold" }}>👤 작성자 선택 (MySQL 연동):</label>
        <select 
          value={currentUser} 
          onChange={(e) => setCurrentUser(e.target.value)}
          style={{ padding: "5px", borderRadius: "4px", border: "1px solid #aaa" }}
        >
          <option value="익명">익명</option>
          {users.map((u) => (
            <option key={u.id} value={u.nickname}>
              {u.nickname} ({u.username})
            </option>
          ))}
        </select>
        <p style={{ margin: "5px 0 0 0", fontSize: "0.8rem", color: "#666" }}>
          * MySQL 'users' 테이블에 있는 사용자를 선택하면, 작성자로 기록됩니다.
        </p>
      </div>

      {/* --- 입력 폼 --- */}
      <div className="form-box" style={{ marginBottom: "30px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f9f9f9" }}>
        
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          {/* 지역 선택 */}
          <select 
            name="region" 
            value={inputs.region} 
            onChange={handleChange} 
            style={{ padding: "8px", flex: 1 }}
          >
            <option value="지역 선택">지역 선택</option>
            {regions.map((regionName) => (
              <option key={regionName} value={regionName}>
                {regionName}
              </option>
            ))}
          </select>

          <select 
            name="category" 
            value={inputs.category} 
            onChange={handleChange}
            style={{ padding: "8px", flex: 1 }}
          >
            <option value="분류 선택">분류 선택</option>
            <option value="관광지">관광지</option>
            <option value="맛집">맛집</option>
            <option value="교통">교통</option>
            <option value="기타">기타</option>
          </select>
        </div>

        <input
          type="text"
          name="title"
          placeholder="제목을 입력하세요"
          value={inputs.title}
          onChange={handleChange}
          style={{ width: "100%", padding: "10px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
        />

        <textarea
          name="content"
          placeholder="내용을 입력하세요"
          value={inputs.content}
          onChange={handleChange}
          style={{ width: "100%", height: "120px", padding: "10px", border: "1px solid #ccc", borderRadius: "4px", resize: "none" }}
        />
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
          <span style={{ fontSize: "12px", color: "#888" }}>
            {inputs.content.length} / 1000자
          </span>
          <button 
            onClick={handleSubmit} 
            style={{ padding: "10px 20px", background: "#333", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
          >
            질문 등록
          </button>
        </div>
      </div>

      {/* --- 게시글 목록 --- */}
      <div className="list-box">
        <h3 style={{ borderBottom: "2px solid #333", paddingBottom: "10px" }}>최근 올라온 질문</h3>
        {list.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
            등록된 질문이 없습니다. 첫 번째 질문을 남겨보세요!
          </div>
        ) : (
          list.map((item, index) => (
            <div key={index} style={{ borderBottom: "1px solid #eee", padding: "20px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                <span style={{ 
                  backgroundColor: "#eee", padding: "3px 8px", borderRadius: "12px", fontSize: "0.8rem", color: "#555" 
                }}>
                  {item.region}
                </span>
                <span style={{ 
                  border: "1px solid #eee", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8rem", color: "#555" 
                }}>
                  {item.category}
                </span>
                {/*작성자 표시 부분 (강조) */}
                <span style={{ fontWeight: "bold", color: "#007bff", fontSize: "0.9rem" }}>
                   🖊 {item.writer}
                </span>
                <span style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#aaa" }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
              
              <div style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "8px" }}>
                {item.title}
              </div>
              <div style={{ fontSize: "1rem", color: "#444", lineHeight: "1.5" }}>
                {item.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Qna;