const APIError = require('../errors/api.error');
const passport = require('../passport');

module.exports = function () {
    return [
        function (req, res, next) {
            next();
        },
        passport.authenticate('jwt', { session: false }),
        function (req, res, next) {
            if (req.user) {
                next();
            } else {
                next(new APIError(401, 'Not Auth'));
            }
        }
    ];
};