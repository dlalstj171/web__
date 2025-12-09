// ===============================
// 기본 설정
// ===============================
const express = require('express');
const cors    = require('cors');
const mysql   = require('mysql2/promise');
const path    = require('path');

// MongoDB 드라이버 추가
const { MongoClient, ObjectId } = require('mongodb');

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
// 3) MySQL 연결 풀 (Review + Users)
// ===============================
// ※ 본인 MySQL 포트/비밀번호 확인 필수
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
// 3-1) MongoDB 연결 (Logs + QnA)
// ===============================
const MONGO_URI  = 'mongodb://127.0.0.1:27017';
const MONGO_DB   = 'travel_logs'; 

let reviewLogsCollection = null; 
let qnaCollection = null;        

async function initMongo() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(MONGO_DB);
    
    // 컬렉션 연결
    reviewLogsCollection = db.collection('review_logs');
    qnaCollection = db.collection('qna'); 
    
    console.log(`MongoDB 연결 완료: ${MONGO_DB} (review_logs, qna)`);
  } catch (err) {
    console.error('MongoDB 연결 실패:', err.message);
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
// 5-1) REST API - MySQL (Review)
// ===============================

// 리뷰 저장
app.post('/api/reviews', async (req, res) => {
  try {
    const { region, rating, content } = req.body;
    const numRating = Number(rating);

    if (!region || !content || !Number.isInteger(numRating)) {
      return res.status(400).json({ message: '잘못된 입력입니다.' });
    }

    // MySQL 저장
    const sql = `INSERT INTO review (region, rating, content) VALUES (?, ?, ?)`;
    const [result] = await pool.execute(sql, [region, numRating, content]);

    // MongoDB 로그 저장
    if (reviewLogsCollection) {
      reviewLogsCollection.insertOne({
        mysqlReviewId: result.insertId,
        region,
        rating: numRating,
        content,
        createdAt: new Date(),
        type: 'REVIEW_BACKUP'
      });
    }

    res.status(201).json({ message: '리뷰 저장 성공', reviewId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 에러' });
  }
});

// 리뷰 조회
app.get('/api/reviews', async (req, res) => {
  try {
    const { region } = req.query;
    let sql = 'SELECT * FROM review';
    const params = [];
    if (region) {
      sql += ' WHERE region = ?';
      params.push(region);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: '서버 에러' });
  }
});

// 유저 목록 조회 (MySQL 구색 맞추기용)
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, nickname FROM users');
    res.json(rows);
  } catch (err) {
    res.json([]); 
  }
});

// ===============================
// 5-2) REST API - MongoDB (QnA)
// ===============================

// 로그 조회
app.get('/api/review-logs', async (req, res) => {
  if (!reviewLogsCollection) return res.status(500).json([]);
  const docs = await reviewLogsCollection.find({}).sort({ createdAt: -1 }).limit(50).toArray();
  res.json(docs);
});

// Q&A 목록 조회
app.get('/api/qna', async (req, res) => {
  if (!qnaCollection) return res.status(500).json({ message: 'DB 미연결' });
  const docs = await qnaCollection.find({}).sort({ createdAt: -1 }).toArray();
  res.json(docs);
});

// Q&A 질문 등록
app.post('/api/qna', async (req, res) => {
  if (!qnaCollection) return res.status(500).json({ message: 'DB 미연결' });

  // 프론트 React에서 보낸 region, category를 여기서 받습니다.
  const { region, category, title, content, writer } = req.body;
  
  const newQna = {
    region: region || '기타',      // 지역 저장
    category: category || '일반',  // 분류 저장
    title,
    content,
    writer: writer || '익명',
    createdAt: new Date(),
    answers: [] 
  };

  await qnaCollection.insertOne(newQna);
  res.json({ success: true });
});

// 답변 등록
app.post('/api/qna/reply', async (req, res) => {
  if (!qnaCollection) return res.status(500).json({ message: 'DB 미연결' });
  const { qna_id, replier, comment } = req.body;

  try {
    await qnaCollection.updateOne(
      { _id: new ObjectId(qna_id) }, 
      { 
        $push: { 
          answers: { 
            replier, 
            comment, 
            createdAt: new Date() 
          } 
        } 
      }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('답변 등록 실패:', err.message);
    res.status(500).json({ message: '답변 등록 실패' });
  }
});

// ===============================
// 6) 서버 시작
// ===============================
app.listen(PORT, () => {
  console.log(`서버 실행됨: http://localhost:${PORT}`);
  console.log(`MySQL(Review) + MongoDB(QnA) 정상 작동 중`);
});