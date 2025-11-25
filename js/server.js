// js/server.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();

// Live Server(5500)에서 오는 요청 허용
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500']
}));
app.use(express.json());

// ===============================
// MySQL 연결 풀 (DB: travel_site)
// ===============================
const pool = mysql.createPool({
  host: 'localhost',
  port: 3307,                // ⭐ MySQL 설치할 때 선택한 포트
  user: 'root',              // root 계정
  password: '1234',  // 설치할 때 정한 비밀번호
  database: 'travel_site',
  waitForConnections: true,
  connectionLimit: 10
});

// 테스트용 루트 엔드포인트
app.get('/', (req, res) => {
  res.send('Review API 서버 동작 중입니다.');
});

// ------------------------------------
// POST /api/reviews : 리뷰 저장
// ------------------------------------
app.post('/api/reviews', async (req, res) => {
  try {
    const { region, rating, content } = req.body;
    const numRating = Number(rating);

    console.log('📥 POST /api/reviews body:', req.body);

    if (!region || !content || !Number.isInteger(numRating) ||
        numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: '지역, 내용, 별점(1~5)을 올바르게 입력해주세요.' });
    }

    const sql = `
      INSERT INTO review (region, rating, content)
      VALUES (?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [region, numRating, content]);

    console.log('✅ 리뷰 저장 성공, insertId =', result.insertId);

    res.status(201).json({
      message: '리뷰가 저장되었습니다.',
      reviewId: result.insertId
    });
  } catch (err) {
    console.error('❌ POST /api/reviews 에러 코드:', err.code);
    console.error('❌ POST /api/reviews 에러 메시지:', err.message);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ------------------------------------
// GET /api/reviews : 리뷰 목록 조회 (최신순)
// ------------------------------------
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
    console.error('❌ GET /api/reviews 에러 코드:', err.code);
    console.error('❌ GET /api/reviews 에러 메시지:', err.message);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Review API 서버가 http://localhost:${PORT} 에서 실행 중`);
});
