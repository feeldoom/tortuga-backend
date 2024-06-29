const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const config = require('./config');
const APIError = require('./errors/api.error');
const userService = require('./services/user.services');

passport.use(
    'local',
    new LocalStrategy(
        async (username, password, done) => {

            // find username and password from mongodb collection
            const user = await userService.authUser(username, password);
                
            if (!user) {
                done(new APIError(401, "Invalid username or password"));
                return;
            }
            
            const token = userService.createAuthToken(user._id.toString());

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
        async (payload, done) => {
            const user = await userService.getUser(payload.id);

            if (user) {
                return done(null, user);
            } else {
                return done(new APIError(401, 'Validation Failed'), false);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user._id.toString());
});

passport.deserializeUser((id, done) => {
    const user = { id, username: 'User' };

    done(null, user);
});

module.exports = passport;