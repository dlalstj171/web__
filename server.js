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
// 0. [핵심 수정] 업로드 폴더 절대 경로 설정
// ===============================================
// __dirname: 현재 server.js가 있는 진짜 위치 (C:\Users\...)
// uploadDir: 그 안에 있는 uploads 폴더의 전체 주소
const uploadDir = path.join(__dirname, 'uploads');

// 폴더가 없으면 만듭니다. (ENOENT 에러 방지)
if (!fs.existsSync(uploadDir)) {
    console.log('ftp: uploads 폴더가 없어 새로 생성합니다 -> ' + uploadDir);
    fs.mkdirSync(uploadDir);
}

// 정적 파일 경로 설정 (외부에서 접근 가능하게)
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================================
// 1. Multer 설정 (위에서 만든 절대 경로 사용)
// ===============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 절대 경로 변수(uploadDir) 대신 그냥 문자열 'uploads/'를 쓰세요.
    // 이게 윈도우 한글 경로 문제에서 훨씬 안전합니다.
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    // 한글 파일 깨짐 방지
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
// 3. MongoDB 연결
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
// 4. 리뷰 작성 API
// ===============================================
app.post('/api/reviews', upload.single('image'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction(); 

    const { region, rating, content, writerId, password } = req.body;
    const numRating = Number(rating);

    // 이미지 경로 저장 (윈도우 역슬래시 문제 해결)
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!region || !content || !writerId || !password) {
      connection.release();
      return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
    }
    // ▲ [수정완료] 여기에 있던 'W' 오타를 지웠습니다!

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
    const sql = `INSERT INTO reviews (user_id, region, rating, content, image_path) VALUES (?, ?, ?, ?, ?)`;
    const [result] = await connection.execute(sql, [finalUserId, region, numRating, content, imagePath]);

    // 로그 저장
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
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        res.status(400).json({ message: 'DB에 없는 지역명입니다.' });
    } else {
        res.status(500).json({ message: '서버 에러 발생' });
    }
  }
});

// ===============================================
// 5. 리뷰 조회 API
// ===============================================
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
    console.error(err);
    res.status(500).json({ message: '목록 조회 실패' });
  }
});

// ===============================================
// 6. QnA API & 삭제 API (기존 유지)
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

app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body; 

    const [rows] = await pool.execute(
      `SELECT r.id, r.image_path FROM reviews r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.id = ? AND u.password = ?`,
      [id, password]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: '비밀번호가 틀렸거나 이미 삭제된 글입니다.' });
    }
    await pool.execute('DELETE FROM reviews WHERE id = ?', [id]);
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    console.error('삭제 에러:', err);
    res.status(500).json({ message: '서버 에러' });
  }
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});