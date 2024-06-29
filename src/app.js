const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const admin = require('firebase-admin');
const methodOverride = require('method-override');
const APIError = require('./errors/api.error');
const cookieParser = require('cookie-parser');
const passport = require('./passport');
const fileRoute = require('./routes/file');
const userRoute = require('./routes/user');
const postRoute = require('./routes/post');

const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

async function initAdminUser() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

  if ( !ADMIN_USERNAME || !ADMIN_PASSWORD ) {
    return;
  }

  const userService = require('./services/user.services');
  const admin = await userService.getUserByUsername(ADMIN_USERNAME);

  if (!admin) {
    await userService.createUser({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    console.log('Admin user created!');
  }
}

initAdminUser();

admin.initializeApp({
  credential: admin.credential.cert(config.fireBase),
  storageBucket: config.fireBase.bucket
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('▶ \x1b[32m[OK]\x1b[0m MongoDB connected'))
  .catch(err => console.error('▶ \x1b[31m[X]\x1b[0m MongoDB connection error:', err));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use(methodOverride('_method'));

app.use(cors({
  origin: (_origin, callback) => callback(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(passport.initialize());

app.use(express.static(path.join(__dirname, '../frontend')));

// Upload PDF's
app.use('/file', fileRoute);

// Auth
app.use('/user', userRoute);

// Posting
app.use('/post', postRoute);

// UptimeRobot ping (deprecated)
app.get('/keepalive', (req, res) => {
  res.sendStatus(200);
});

// Cron schedule to up server on render.com
cron.schedule('*/10 * * * *', async () => {
  try {
    const response = await fetch(`http://localhost:${PORT}/keepalive`);
    console.log('▶ \x1b[32m[CPR]\x1b[0m Keepalive response:', response.status);
  } catch (error) {
    console.error('▶ [X] Keepalive error:', error);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof APIError) {
    res.status(err.status).json({ err: err.message });
    return;
  }

  res.sendStatus(500);
});

app.listen(PORT, () => {
  console.log(`▶ \x1b[32m[OK]\x1b[0m Server is running on http://localhost:${PORT}`);
});