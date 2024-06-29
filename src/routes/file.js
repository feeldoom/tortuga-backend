const express = require('express');
const multer = require('multer');
const firebaseStorage = require('../storages/firebase.storage');

const fileService = require('../services/file.service');
const requireAuth = require('../middlewares/requireAuth');
const APIError = require('../errors/api.error');

const route = express.Router();

//Multer Firebase Storage settings
const upload = multer({
    storage: firebaseStorage
});

// Stream files by filename
route.get('/:fileName', async (req, res, next) => {
    const { fileName } = req.params;

    const stream = await fileService.getFileReadStream(fileName);

    if (!stream) {
        next(new APIError(404, 'File Not Found!'));
        return;
    }

    stream.on('error', (_error) => {
        next(new APIError(500, 'Cannot read file'));
    });

    res.on('close', () => {
        stream.destroy();
    });


    stream.pipe(res);
});

// Middleware for posting menu pdf files
route.post('/menu', requireAuth(), upload.fields([{ name: 'menu', maxCount: 1 }, { name: 'bar', maxCount: 1 }]), async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    const resolveFileNameByField = (field) => {
        switch (field) {
            case 'bar': return 'bar.pdf';
            case 'menu': return 'menu.pdf';
        }
        return null;
    };

    for (const [key, file] of Object.entries(req.files)) {
        const fileName = resolveFileNameByField(key);
        const [{ path: firebasePath }] = file;
        
        await fileService.deleteFile({ fileName });

        await fileService.saveFile({ fileName, firebasePath });
    }

    res.send();
});

module.exports = route;
