const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const jwt = require('jsonwebtoken');
const config = require('./config');
const APIError = require('./errors/api.error');

passport.use(
    'local',
    new LocalStrategy(
        (username, password, done) => {
            const { user } = config.devTest;

            if (
                username !== user.username ||
                password !== user.password
            ) {
                done(new APIError(401, 'Invalid username or password'));
            }

            const token = jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: '1h' });

            done(null, token);
        }
    )
);

passport.use(
    'jwt',
    new JwtStrategy(
        {
            secretOrKey: config.jwtSecret,
            jwtFromRequest: ExtractJwt.fromExtractors([

                ExtractJwt.fromAuthHeaderAsBearerToken(),

                (req) => {
                    return req.cookies[config.cookieSessionKey];
                }
            ]),
        },
        (payload, done) => {
            const { id: userId } = payload;

            if (userId && userId === config.devTest.user.id) {
                return done(null, config.devTest.user);
            } else {
                return done(new APIError(401, 'Validation Failed'), false);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    const user = { id, username: 'User' };

    done(null, user);
});

module.exports = passport;