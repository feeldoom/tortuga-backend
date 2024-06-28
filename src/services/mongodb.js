const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('▶ \x1b[32m[OK]\x1b[0m MongoDB connected'))
    .catch(err => console.error('▶ \x1b[31m[X]\x1b[0m MongoDB connection error:', err));

module.exports = mongoose;