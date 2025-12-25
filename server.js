const express = require('express');
const cors    = require('cors');
const mysql   = require('mysql2/promise');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { MongoClient, ObjectId } = require('mongodb');

const app  = express();
const PORT = process.env.PORT || 3000;

// ===============================================
// 0. 폴더 설정 및 정적 파일 서빙
// ===============================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// [중요] React 빌드 폴더(dist)를 최우선으로 인식하게 합니다.
app.use(express.static(path.join(__dirname, 'dist'))); 
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [중요] 접속 시 React 메인 화면(index.html)을 보여줍니다.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ===============================================
// 1. Multer 이미지 업로드 설정
// ===============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/'); },
  filename: (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// ===============================================
// 2. MySQL 연결 설정
// ===============================================
const pool = mysql.createPool({
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: '1234',
  database: 'travel_site',
  waitForConnections: true,
  connectionLimit: 10
});

// ===============================================
// 3. MongoDB 연결 설정
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
    console.log('MongoDB 연결 실패 (MySQL은 정상 작동)');
  }
}
initMongo();

// ===============================================
// 4. 리뷰(Review) API - MySQL 연동
// ===============================================
app.post('/api/reviews', upload.single('image'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction(); 
    const { region, rating, content, writerId, password } = req.body;
    const numRating = Number(rating);
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!region || !content || !writerId || !password) {
      connection.release();
      return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
    }

    const [existingUsers] = await connection.execute(
      'SELECT id, password FROM users WHERE username = ?', [writerId]
    );

    let finalUserId = null;
    if (existingUsers.length > 0) {
      if (existingUsers[0].password !== password) {
        connection.release();
        return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
      }
      finalUserId = existingUsers[0].id;
    } else {
      const [insertUserResult] = await connection.execute(
        'INSERT INTO users (username, password) VALUES (?, ?)', [writerId, password]
      );
      finalUserId = insertUserResult.insertId;
    }

    const sql = `INSERT INTO reviews (user_id, region, rating, content, image_path) VALUES (?, ?, ?, ?, ?)`;
    const [result] = await connection.execute(sql, [finalUserId, region, numRating, content, imagePath]);

    if (reviewLogsCollection) {
      reviewLogsCollection.insertOne({
        mysqlReviewId: result.insertId,
        writerId, region, rating: numRating, content,
        hasImage: !!imagePath,
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
    res.status(500).json({ message: '서버 에러 발생' });
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const { region } = req.query;
    let sql = `
      SELECT r.id, r.region, r.rating, r.content, r.image_path, r.created_at, u.username as nickname
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
    res.status(500).json({ message: '목록 조회 실패' });
  }
});

app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body; 
    const [rows] = await pool.execute(
      `SELECT r.id FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.id = ? AND u.password = ?`,
      [id, password]
    );
    if (rows.length === 0) {
      return res.status(403).json({ message: '비밀번호가 틀렸거나 없는 글입니다.' });
    }
    await pool.execute('DELETE FROM reviews WHERE id = ?', [id]);
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ message: '서버 에러' });
  }
});

// ===============================================
// 5. Q&A API - MongoDB 연동
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
// 6. 서버 실행
// ===============================================
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});