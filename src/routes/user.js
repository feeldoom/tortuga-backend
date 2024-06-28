const express = require('express');
const passport = require('../passport');
const config = require('../config');
const requireAuth = require('../middlewares/requireAuth');

const route = express.Router();

route.post('/login', passport.authenticate('local', { session: false }), async (req, res) => {
    const token = req.user;

    res
        .cookie(config.cookieSessionKey, token, { httpOnly: true, secure: true, sameSite: 'none' })
        .json({ token });
});

route.get('/me', requireAuth(), async (req, res) => {
    res.json(req.user);
});

module.exports = route;