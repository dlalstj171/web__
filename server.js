const express = require('express');
const cors    = require('cors');
const mysql   = require('mysql2/promise');
const path    = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app  = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 경로 설정
app.use(express.static(__dirname));
app.use(cors());
app.use(express.json());

// ===============================================
// 1. MySQL 연결 설정
// ===============================================
const pool = mysql.createPool({
  host: 'localhost',
  port: 3307,          // 포트 번호 확인
  user: 'root',
  password: '1234',    // 비밀번호 확인
  database: 'travel_site',
  waitForConnections: true,
  connectionLimit: 10
});

// ===============================================
// 2. MongoDB 연결 (옵션)
// ===============================================
const MONGO_URI  = 'mongodb://127.0.0.1:27017';
const MONGO_DB   = 'travel_logs'; 
let reviewLogsCollection = null; 
let qnaCollection = null;

async function initMongo() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(MONGO_DB);
    reviewLogsCollection = db.collection('review_logs');
    qnaCollection = db.collection('qna');
    console.log('MongoDB 연결 완료');
  } catch (err) {
    console.log('MongoDB 연결 실패 (MySQL 기능은 정상 작동)');
  }
}
initMongo();

// ===============================================
// 3. 리뷰 작성 API (자동 회원가입 + 트랜잭션)
// ===============================================
app.post('/api/reviews', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction(); 

    const { region, rating, content, writerId, password } = req.body;
    const numRating = Number(rating);

    if (!region || !content || !writerId || !password) {
      connection.release();
      return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
    }

    // 사용자 확인
    const [existingUsers] = await connection.execute(
      'SELECT id, password FROM users WHERE username = ?', 
      [writerId]
    );

    let finalUserId = null;

    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      if (user.password !== password) {
        connection.release();
        return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
      }
      finalUserId = user.id; 
    } else {
      const [insertUserResult] = await connection.execute(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [writerId, password]
      );
      finalUserId = insertUserResult.insertId;
    }

    // 리뷰 저장
    const sql = `INSERT INTO reviews (user_id, region, rating, content) VALUES (?, ?, ?, ?)`;
    const [result] = await connection.execute(sql, [finalUserId, region, numRating, content]);

    // 로그 저장
    if (reviewLogsCollection) {
      reviewLogsCollection.insertOne({
        mysqlReviewId: result.insertId,
        writerId, region, rating: numRating, content,
        createdAt: new Date(), type: 'REVIEW_NEW'
      });
    }

    await connection.commit();
    connection.release();
    res.status(201).json({ message: '리뷰 등록 완료!' });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('리뷰 저장 에러:', err);
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        res.status(400).json({ message: 'DB에 없는 지역명입니다.' });
    } else {
        res.status(500).json({ message: '서버 에러 발생' });
    }
  }
});

// ===============================================
// 4. 리뷰 조회 API (JOIN 사용)
// ===============================================
app.get('/api/reviews', async (req, res) => {
  try {
    const { region } = req.query;

    let sql = `
      SELECT r.id, r.region, r.rating, r.content, r.created_at, u.username as nickname
      FROM reviews r
      JOIN users u ON r.user_id = u.id
    `;
    
    const params = [];
    if (region && region !== '전체 지역' && region !== '') {
      sql += ' WHERE r.region = ?';
      params.push(region);
    }
    sql += ' ORDER BY r.created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '목록 조회 실패' });
  }
});

// ===============================================
// 5. QnA API (MongoDB)
// ===============================================
app.get('/api/qna', async (req, res) => {
  if (!qnaCollection) return res.status(500).json({ message: 'DB 미연결' });
  const docs = await qnaCollection.find({}).sort({ createdAt: -1 }).toArray();
  res.json(docs);
});

app.post('/api/qna', async (req, res) => {
  if (!qnaCollection) return res.status(500).json({ message: 'DB 미연결' });
  const { region, category, title, content, writer } = req.body;
  
  await qnaCollection.insertOne({
    region: region || '기타', category: category || '일반',
    title, content, writer: writer || '익명',
    createdAt: new Date(), answers: []
  });
  res.json({ success: true });
});

app.post('/api/qna/reply', async (req, res) => {
  if (!qnaCollection) return res.status(500).json({ message: 'DB 미연결' });
  const { qna_id, replier, comment } = req.body;
  try {
    await qnaCollection.updateOne(
      { _id: new ObjectId(qna_id) }, 
      { $push: { answers: { replier, comment, createdAt: new Date() } } }
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: '답변 실패' }); }
});

// ===============================================
// 6. 리뷰 삭제 API (최종 하나만 남김)
// ===============================================
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body; 

    // 비밀번호 확인
    const [rows] = await pool.execute(
      `SELECT r.id FROM reviews r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.id = ? AND u.password = ?`,
      [id, password]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: '비밀번호가 틀렸거나 이미 삭제된 글입니다.' });
    }

    // 삭제 실행
    await pool.execute('DELETE FROM reviews WHERE id = ?', [id]);
    
    res.json({ message: '삭제되었습니다.' });

  } catch (err) {
    console.error('삭제 에러:', err);
    res.status(500).json({ message: '서버 에러' });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});