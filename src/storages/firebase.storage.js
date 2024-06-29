const firebaseStorage = require('multer-firebase-storage');

const config = require('../config');

module.exports = firebaseStorage({ 
    bucketName: config.fireBase.bucket,
        credentials: {
            clientEmail: config.fireBase.client_email,
            privateKey: config.fireBase.private_key,
            projectId: config.fireBase.project_id
        },
        unique: true,
        // public: true
});