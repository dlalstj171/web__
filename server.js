// js/server.js 가 아니라, 프로젝트 루트에 server.js 있다고 가정
// (지금처럼 main.html, js/, css/, img/랑 같은 위치)

// ===============================
// 기본 설정
// ===============================
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// 1) 정적 파일 서빙 (HTML / CSS / JS / 이미지)
// ===============================
// __dirname = server.js가 있는 폴더 (지금 프로젝트 루트)
const publicRoot = __dirname;

// /main.html, /seoul.html, /css/main.css, /js/review.js 같은 파일을
// http://localhost:3000/ 아래에서 바로 열 수 있게 함
app.use(express.static(publicRoot));

// ===============================
// 2) CORS & JSON 파서
// ===============================
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ]
}));
app.use(express.json());

// ===============================
// 3) MySQL 연결 풀 (DB: travel_site)
// ===============================
const pool = mysql.createPool({
  host: 'localhost',
  port: 3307,                // 네가 쓰고 있는 포트
  user: 'root',              // 계정
  password: '1234',          // 비밀번호
  database: 'travel_site',
  waitForConnections: true,
  connectionLimit: 10
});

// ===============================
// 4) 기본 페이지: / 로 들어오면 main.html 보내기
// ===============================
app.get('/', (req, res) => {
  res.sendFile(path.join(publicRoot, 'main.html'));
});

// ===============================
// 5) REST API - 리뷰 저장/조회
//     주소는 전부 /api/... 으로 고정
// ===============================

// POST /api/reviews : 리뷰 저장
app.post('/api/reviews', async (req, res) => {
  try {
    const { region, rating, content } = req.body;
    const numRating = Number(rating);

    console.log('📥 POST /api/reviews body:', req.body);

    if (!region || !content || !Number.isInteger(numRating) ||
        numRating < 1 || numRating > 5) {
      return res
        .status(400)
        .json({ message: '지역, 내용, 별점(1~5)을 올바르게 입력해주세요.' });
    }

    const sql = `
      INSERT INTO review (region, rating, content)
      VALUES (?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [region, numRating, content]);

    console.log('리뷰 저장 성공, insertId =', result.insertId);

    res.status(201).json({
      message: '리뷰가 저장되었습니다.',
      reviewId: result.insertId
    });
  } catch (err) {
    console.error('POST /api/reviews 에러 코드:', err.code);
    console.error('POST /api/reviews 에러 메시지:', err.message);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/reviews : 리뷰 목록 조회 (최신순)
app.get('/api/reviews', async (req, res) => {
  try {
    const { region } = req.query;

    let sql = 'SELECT id, region, rating, content, created_at FROM review';
    const params = [];

    if (region) {
      sql += ' WHERE region = ?';
      params.push(region);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(sql, params);
    console.log(`📤 GET /api/reviews (${region || '전체'}) -> ${rows.length}개`);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/reviews 에러 코드:', err.code);
    console.error('GET /api/reviews 에러 메시지:', err.message);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ===============================
// 6) 서버 시작
// ===============================
app.listen(PORT, () => {
  console.log(`서버 실행됨 → http://localhost:${PORT}`);
});
