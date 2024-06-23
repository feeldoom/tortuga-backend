const express = require('express');
const multer = require('multer');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const cron = require('node-cron');
const { getStorage, getDownloadURL } = require('firebase-admin/storage');
const { createProxyMiddleware } = require('http-proxy-middleware');
const User = require('./models/user');
const Post = require('./models/post'); 
const methodOverride = require('method-override');

const app = express();
const PORT = process.env.PORT || 3000;

const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL,
  "universe_domain": process.env.FIREBASE_UNIVERSE_DOMAIN
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'tortuga-backend.appspot.com'
});

const bucket = admin.storage().bucket();

const basestorage = admin.storage();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'menu' || file.fieldname === 'bar') {
      cb(null, true);
    } else {
      cb(new Error('Unexpected field'));
    }
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPostPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

app.use(methodOverride('_method'));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT,DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200); 
  }
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'access-control-allow-origin']
}));

app.use(session({
  secret: 'TzDFG8O5cF',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api', createProxyMiddleware({
  target: 'https://tortuga-backend.onrender.com',
  changeOrigin: true,
}));

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('https://tortuga-front.vercel.app/login.html');
  }
  next();
};

app.use('/admin', requireAuth);

app.use('/uploads', requireAuth, express.static(uploadsDir));
// app.use('/admin.html', requireAuth, express.static(path.join(__dirname, '../frontend/admin.html')));

app.get('/admin.html', requireAuth, (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
  } else {
    res.redirect('https://tortuga-front.vercel.app/login.html');
  }
});

app.use(express.static(path.join(__dirname, '../frontend')));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });

  if (user) {
    req.session.userId = user._id;
    return res.redirect('https://tortuga-front.vercel.app/admin.html');
  } else {
    return res.status(401).send('Invalid login');
  }
});

app.post('/upload', requireAuth, upload.fields([{ name: 'menu', maxCount: 1 }, { name: 'bar', maxCount: 1 }]), async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files uploaded.');
  }

  const files = req.files;
  const fileKeys = Object.keys(files);

  const promises = fileKeys.map(async (key) => {
    const file = files[key][0];
    const fileName = file.originalname;
    const fileBuffer = file.buffer;
    const contentType = file.mimetype;

    let newFileName;
    if (key === 'menu') {
      newFileName = 'menu.pdf';
    } else if (key === 'bar') {
      newFileName = 'bar.pdf';
    } else {
      return Promise.reject(new Error('Unexpected field'));
    }

    try {
      await bucket.file(newFileName).save(fileBuffer, {
        contentType,
        resumable: false
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      return Promise.reject(error);
    }
  });

  try {
    await Promise.all(promises);
    res.redirect('https://tortuga-front.vercel.app/admin.html?status=success');
  } catch (error) {
    res.redirect('https://tortuga-front.vercel.app/admin.html?status=error');
  }
});

app.post('/uploadPhoto', requireAuth, uploadPostPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const file = req.file;
    const fileName = Date.now() + '-' + file.originalname;
    const fileBuffer = file.buffer;
    const contentType = file.mimetype;

    try {
      await bucket.file(fileName).save(fileBuffer, {
        contentType,
        resumable: false
      });
      
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      // Делайте что-то с imageUrl, например, сохраните его в базе данных или отправьте обратно в ответе
      res.redirect(`https://tortuga-front.vercel.app/admin.html?status=success&imageUrl=${imageUrl}`);
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).send('Error uploading file.');
    }
  } catch (error) {
    console.error('Error processing file upload:', error);
    return res.status(500).send('Error processing file upload.');
  }
});


app.get('/pdfs', async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    const pdfFiles = files.filter(file => file.name.endsWith('.pdf')).map(file => file.name);
    res.json({ files: pdfFiles });
  } catch (error) {
    console.error('Error getting PDF files:', error);
    res.status(500).json({ message: 'Unable to get PDF files.' });
  }
});

// New post
app.post('/uploadPost', requireAuth, uploadPostPhoto.fields([{ name: 'photo', maxCount: 1 }]), async (req, res) => {
  try {
    const photoFile = req.files['photo'] ? req.files['photo'][0] : null;
    const photoUrl = photoFile ? await uploadFile(photoFile) : null;

    const { title, text } = req.body;
    const newPost = new Post({ title, text, photo: photoUrl });
    await newPost.save();

    res.redirect(`https://tortuga-front.vercel.app/admin.html?status=success`);
  } catch (error) {
    console.error('Error uploading file or creating post:', error);
    res.redirect(`https://tortuga-front.vercel.app/admin.html?status=error`);
  }
});

async function uploadFile(file) {
  const fileName = Date.now() + '-' + file.originalname;
  const fileBuffer = file.buffer;
  const contentType = file.mimetype;

  try {
    await bucket.file(fileName).save(fileBuffer, {
      contentType,
      resumable: false
    });

    const fileRef = basestorage.bucket().file(fileName);
    const imageUrl = await getDownloadURL(fileRef);
    return imageUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Error uploading file.');
  }
}

// Get all posts
app.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find({ ignored: false });
    res.json(posts);
  } catch (error) {
    console.error('Error getting posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//Delete post
app.delete('/posts/:id', requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // await Post.findByIdAndUpdate(postId, { ignored: true });
    await Post.findByIdAndDelete(postId);
    
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/keepalive', (req, res) => {
  res.sendStatus(200);
});

// Schedule the keepalive task
cron.schedule('*/10 * * * *', async () => {
  try {
    const response = await fetch(`http://localhost:${PORT}/keepalive`);
    console.log('Keepalive response:', response.status);
  } catch (error) {
    console.error('Keepalive error:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});