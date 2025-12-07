// ===============================
// 기본 설정
// ===============================
const express = require('express');
const cors    = require('cors');
const mysql   = require('mysql2/promise');
const path    = require('path');

// 🔹 MongoDB 드라이버 추가
const { MongoClient } = require('mongodb');

const app  = express();
const PORT = process.env.PORT || 3000;

// ===============================
// 1) 정적 파일 서빙
// ===============================
const publicRoot = __dirname;
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
// 3) MySQL 연결 풀
// ===============================
const pool = mysql.createPool({
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: '1234',
  database: 'travel_site',
  waitForConnections: true,
  connectionLimit: 10
});

// ===============================
// 3-1) MongoDB 연결 (review_logs 컬렉션)
// ===============================
const MONGO_URI  = 'mongodb://127.0.0.1:27017';
const MONGO_DB   = 'travel_logs';
const MONGO_COLL = 'review_logs';

let reviewLogsCollection = null; // 연결 후에 세팅됨

async function initMongo() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(MONGO_DB);
    reviewLogsCollection = db.collection(MONGO_COLL);
    console.log('MongoDB 연결 완료:', MONGO_DB, '/', MONGO_COLL);
  } catch (err) {
    console.error('❌ MongoDB 연결 실패:', err.message);
  }
}
initMongo();

// ===============================
// 4) 기본 페이지
// ===============================
app.get('/', (req, res) => {
  res.sendFile(path.join(publicRoot, 'main.html'));
});

// ===============================
// 5) REST API - 리뷰 저장/조회
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

    // 1) MySQL에 저장 (기존 기능)
    const sql = `
      INSERT INTO review (region, rating, content)
      VALUES (?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [region, numRating, content]);

    console.log('✅ MySQL 리뷰 저장 성공, insertId =', result.insertId);

    // 2) MongoDB에 로그/백업 저장 (새 기능)
    if (reviewLogsCollection) {
      reviewLogsCollection.insertOne({
        mysqlReviewId: result.insertId,
        region,
        rating: numRating,
        content,
        createdAt: new Date(),
        userAgent: req.headers['user-agent'] || ''
      }).then(() => {
        console.log('📦 MongoDB review_logs 에 로그 저장 완료');
      }).catch(err => {
        console.error('⚠ MongoDB 로그 저장 실패:', err.message);
      });
    } else {
      console.warn('⚠ MongoDB 미연결 상태라 로그를 저장하지 못함');
    }

    // 최종 응답은 기존처럼 성공 처리
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

// GET /api/reviews : MySQL 리뷰 목록 조회 (기존 기능 그대로)
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

// (선택) MongoDB에 쌓인 로그를 확인하는 API
app.get('/api/review-logs', async (req, res) => {
  try {
    if (!reviewLogsCollection) {
      return res.status(500).json({ message: 'MongoDB 연결 안 됨' });
    }
    const docs = await reviewLogsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    res.json(docs);
  } catch (err) {
    console.error('❌ GET /api/review-logs 에러:', err.message);
    res.status(500).json({ message: 'Mongo 로그 조회 중 오류' });
  }
});

// ===============================
// 6) 서버 시작
// ===============================
app.listen(PORT, () => {
  console.log(`서버 실행됨 → http://localhost:${PORT}`);
});
