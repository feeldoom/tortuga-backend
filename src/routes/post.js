const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');

const firebaseStorage = require('../storages/firebase.storage');
const requireAuth = require('../middlewares/requireAuth');
const Post = require('../models/post');
const APIError = require('../errors/api.error');

const fileService = require('../services/file.service');


const uploadPostPhoto = multer({
    storage: firebaseStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});

const route = express.Router();

// New post
route.post('/', requireAuth(), uploadPostPhoto.single('photo'), async (req, res, next) => {
    const { title, text } = req.body;

    if (!title || !text) {
        next(new APIError(422, 'Title/text content is empty!'));
        return;
    }

    try {
        let file;

        if (req.file) {
            file = await fileService.saveFile({ fileName: req.file.fileRef.name, firebasePath: req.file.path });
        }

        const post = await Post.create({ title, text, photo: file ? file.fileName : null });

        res.send(post);
    } catch (error) {
        console.error('Error uploading file or creating post:', error);
        next(new APIError(500, error.message));
    }
});

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

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        await Post.findByIdAndDelete(postId);

        // Delete the photo if it exist
        if (post.photo) {
            try {
                await fileService.deleteFile({ fileName: post.photo });
            } catch (error) {
                console.error('Error deleting associated photo:', error);
                return res.status(500).json({ message: 'Failed to delete associated photo' });
            }
        }

        res.sendStatus(204);
    } catch (error) {
        console.error('▶ [X] Error deleting post:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = route;