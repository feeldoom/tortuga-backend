const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const config = require('../config');

class UserService {
    async createUser(data) {
        // hash the password
        const passwordHash = this._createPasswordHash(data.password);

        // creating user
        const user = await User.create({
            ...data,
            password: passwordHash
        });

        return this._sanitizeUser(user);
    }

    async getUser(userId) {
        const user = await User.findById(userId);
        if (!user) {
            return null;
        }

        return this._sanitizeUser(user);
    }

    async getUserByUsername(username) {
        const user = await User.findOne({ username });
        if (!user) {
            return null;
        }

        return this._sanitizeUser(user);
    }

    // returns user if username and password is correct
    async authUser(username, password) {
        const passwordHash = this._createPasswordHash(password);

        const user = await User.findOne({ username, password: passwordHash });
        if (!user) {
            return null;
        }

        return this._sanitizeUser(user);
    }

    createAuthToken(userId, duration = '1h') {
        return jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: duration });
    }

    _sanitizeUser(user) {
        const sanitizedUser = user.toObject();

        delete sanitizedUser.password;

        return sanitizedUser;
    }

    _createPasswordHash(password) {
        return crypto.createHash('md5').update(password).digest('hex');
    }
}

module.exports = new UserService();
