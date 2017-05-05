import Debug from 'debug';
import request from 'request-promise';
import userDefaults from '../../lib/userDefaults';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';
import tokenFactory from '../../lib/tokenFactory';

const debug = Debug('routes.auth.facebookLogin');
const errorMessage = 'Invalid credentials.  Please try again.';

export default (req, res) => validate(req.body, {
  email: schemas.user.email,
  accessToken: schemas.facebook.accessToken,
  applicationID: schemas.facebook.applicationID,
}, ['email', 'accessToken', 'applicationID'], [], { allowUnknown: true })
  .catch(() => {
    throw new Error(errorMessage);
  })
  .then(() => {
    const {
      accessToken: reqAccessToken,
      applicationID: reqAppID,
    } = req.body;
    const options = {
      method: 'GET',
      uri: 'https://graph.facebook.com/debug_token',
      qs: {
        input_token: reqAccessToken,
        access_token: `${process.env.APP_ID}|${process.env.APP_SECRET}`,
      },
      json: true,
    };

    // Checks whether the access token and app id from req is valid and matches
    // our app id.
    return request(options)
      .then((result) => {
        const { app_id: debugTokenAppID, is_valid: isValid } = result.data;
        if (debugTokenAppID !== reqAppID || !isValid) {
          throw new Error(errorMessage);
        }
      });
  })
  .then(() => {
    const {
      email,
      gender,
      first_name: firstName,
      last_name: lastName,
      birthday: birthdate,
    } = req.body;

    // Check if there is already a user with this email
    return dbManager.getDb()
      .collection('users')
      .find({ email: new RegExp(email, 'i') })
      .limit(1)
      .next()
      .then((user) => {
        if (!user) {
          // Create new local user for facebook user
          return dbManager.getDb()
            .collection('users')
            .insertOne(userDefaults.mergeWithDefaultData({
              email,
              nickName: firstName,
              firstName,
              lastName,
              gender: (gender === 'male' ? 1 : 2),
              birthdate: (birthdate ? (new Date(birthdate)) : null),
              password: null,
              isConfirmed: true,
              authMethod: 'facebook',
              createdAt: new Date(),
            }))
            .then(newDoc => newDoc.ops[0]);
        } else if (user.authMethod === 'password') {
          throw new Error('Please login using your email and password');
        }
        return user;
      });
  })
  .then((user) => {
    // Generate an access token
    const { _id: userId } = user;

    return tokenFactory.createAccessToken(userId)
      .then((accessToken) => {
        debug('Generated access token', accessToken);

        return dbManager.getDb()
          .collection('accessTokens')
          .insertOne({ userId, accessToken })
          .then(() => [user, accessToken]);
      });
  })
  .then(([user, accessToken]) => {
    // Return sanitized user object with access token
    const userResult = sanitizeUser(user);
    userResult.accessToken = accessToken;
    return userResult;
  })
  .catch((err) => {
    if (err.message === errorMessage) {
      // Use 401 status code for invalid auth errors
      res.status(401);
    }
    throw err;
  });
