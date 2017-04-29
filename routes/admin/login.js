import Debug from 'debug';
import GoogleAuth from 'google-auth-library';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';

const debug = Debug('routes:admin:login');

const auth = new GoogleAuth();
const client = new auth.OAuth2(process.env.GOOGLE_CLIENT_ID);

/**
 * Verifies an internal user using their Google Auth ID token obtained from the
 * client side. For a valid ID token, an access token is created for the internal
 * user which can be later used to access protected admin routes. The access token
 * along with their Google user account info is returned in the response.
 *
 * https://developers.google.com/identity/sign-in/web/backend-auth
 * @param {Object} req              Request
 * @param {Object} res              Response
 * @param {Object} req.body         Request body
 * @param {String} req.body.idToken Google ID token
 * @return {Promise} Resolves with a user object containing an access token
 */
export default (req, res) => validate(req.body, {
  idToken: schemas.googleIdToken,
}, ['idToken'])
  .then(() => new Promise((resolve, reject) => {
    debug('Verifying ID token', req.body.idToken);
    client.verifyIdToken(req.body.idToken, process.env.GOOGLE_CLIENT_ID, (err, login) => {
      if (err) {
        debug('Error verifying id token', err);
        res.status(500);
        reject(err);
      } else if (!login || !login.getPayload) {
        debug('Unknown login response from verifyIdToken');
        res.status(500);
        reject(new Error('Unknown login response from verifyIdToken'));
      } else {
        const {
          sub: id,
          name,
          given_name: firstName,
          family_name: lastName,
          picture,
          email,
          hd: domain,
        } = login.getPayload();

        // Verify Google account belongs to gobackbone.com
        if (domain !== 'gobackbone.com') {
          res.status(401);
          reject(new Error('Unauthorized account'));
        } else {
          const user = {
            id,
            name,
            firstName,
            lastName,
            picture,
            email,
          };
          debug('Valid Google account', user);
          resolve(user);
        }
      }
    });
  })
    .then((user) => {
      // Generate an access token for the user
      const email = user.email;
      return Promise.all([user, tokenFactory.createAccessToken(email)]);
    })
    .then(([user, accessToken]) => {
      const {
        id: googleId,
        name,
        firstName,
        lastName,
        email,
        picture,
      } = user;

      // Store Google user info along with access token
      return dbManager.getDb()
        .collection('internalUsers')
        .findOneAndUpdate(
          { email },
          { $set: { googleId, name, firstName, lastName, email, picture, accessToken } },
          { upsert: true, returnOriginal: false }
        );
    })
    .then(result => result.value)
  );
