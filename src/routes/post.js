const express = require('express');
const multer = require('multer');
const admin = require('firebase-admin');
const { getDownloadURL } = require('firebase-admin/storage');
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');
const Post = require('../models/post'); 
const config = require('../config');
const APIError = require('../errors/api.error');

admin.initializeApp({
    credential: admin.credential.cert(config.fireBase),
    storageBucket: 'tortuga-backend.appspot.com'
});


const route = express.Router();

const bucket = admin.storage().bucket();

const basestorage = admin.storage();

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

// New post
route.post('/', requireAuth(), uploadPostPhoto.fields([{ name: 'photo', maxCount: 1 }]), async (req, res, next) => {
    if (!req.body.text) {
        next(new APIError(422, 'Field text is required.'));
        return;
    }
    try {
        const photoFile = req.files['photo'] ? req.files['photo'][0] : null;
        const photoUrl = photoFile ? await uploadFile(photoFile) : null;

        const { title, text } = req.body;
        const newPost = new Post({ title, text, photo: photoUrl });
        await newPost.save();
        res.send(newPost);
    } catch (error) {
        console.error('Error uploading file or creating post:', error);
        next(new APIError(500, error.message));
    }
});

// Upload photo
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
route.get('/', async (req, res) => {
    try {
        const posts = await Post.find({ ignored: false });
        res.json(posts);
    } catch (error) {
        console.error('Error getting posts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete post
route.delete('/:id', requireAuth(), async (req, res) => {
    try {
        const postId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ message: 'Invalid post ID' });
        }

        await Post.findByIdAndDelete(postId);

        res.sendStatus(204);
    } catch (error) {
        console.error('▶ [X] Error deleting post:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = route;