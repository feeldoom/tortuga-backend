const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  text: { type: String, required: true },
  dateAdded: { type: Date, default: Date.now },
  photo: { type: String }
});

module.exports = mongoose.model('Post', postSchema);