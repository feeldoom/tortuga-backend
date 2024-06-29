const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const File = require('../models/file');

function resolveFilePath(fileName) {
    return path.join(process.cwd(), config.filesDir, fileName);
}

class FileService {
    // save uploaded to firebase file to the database
    async saveFile({ fileName, firebasePath }) {
        const file = await File.create({ fileName, firebasePath });

        return file;
    }

    async deleteFile({ fileName }) {
        const files = await File.find({ fileName });

        await Promise.all(
            files.map(async file => {
                const filePath = resolveFilePath(file.firebasePath);
                await fs.promises.unlink(filePath).catch(() => { });
                await admin
                    .storage()
                    .bucket()
                    .file(file.firebasePath)
                    .delete()
                    .catch(() => { });
            })
        );

        await File.deleteMany({ fileName });
    }

    // download files from firebase to upload folder
    async syncFile(fileName) {
        const file = await File.findOne({ fileName });

        if (!file) {
            return false;
        }

        // downloading file from firebase
        await admin
            .storage()
            .bucket()
            .file(file.firebasePath)
            .download({ destination: resolveFilePath(file.firebasePath) });

        return true;
    }

    async getFileReadStream(fileName) {
        const file = await File.findOne({ fileName });

        // if file is not exist
        if (!file) {
            return null;
        }

        const filePath = resolveFilePath(file.firebasePath);

        try {
            // check if file attirbutes
            const stat = await fs.promises.stat(filePath);
            if (!stat.isFile()) {
                return null;
            }
        } catch (_err) { // cannot find file
            // file should be downloaded from firebase
            const syncResult = await this.syncFile(fileName);
            if (!syncResult) {
                return null;
            }
        }

        // create stream to read file
        return fs.createReadStream(filePath);
    }
}

module.exports = new FileService();