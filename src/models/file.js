const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    fileName: { type: String, required: true },
    firebasePath: { type: String, required: true },
});

module.exports = mongoose.model('File', schema);