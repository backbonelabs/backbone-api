import crypto from 'crypto';
import Joi from 'joi';
import validate from '../../lib/validate';
import dbManager from '../../lib/dbManager';
import passwordUtil from '../../lib/password';

const errorMessage = 'Email and password do not match';

/**
 * Verifies a user account by checking the email and password and returns an
 * object with an access token that the user can use in subsequent requests
 * to access protected API endpoints. The access token is a hash of the user
 * ID and current timestamp separated by a colon.
 * @param  {Object} req               Request
 * @param  {Object} req.body          Request body
 * @param  {String} req.body.email    Email address
 * @param  {String} req.body.password Password
 * @return {Promise} Resolves with an object that includes the email and access
 *                   token: {email, accessToken}
 */
export default (req, res) => validate(req.body, {
  email: Joi.string().email().required(),
  password: Joi.string().required(),
})
  .then(() => {
    const { email, password } = req.body;
    // Check if there is a user with the email address
    return dbManager.getDb()
      .collection('users')
      .findOne({ email })
      .then(user => {
        if (user) {
          return user;
        }
        throw new Error(errorMessage);
      })
      .then(user => (
        // Verify password matches
        Promise.all([user, passwordUtil.verify(password, user.password)])
      ))
      .then(([user, isPasswordMatch]) => {
        if (isPasswordMatch) {
          // Generate an access token
          const { _id: userId } = user;
          const hmac = crypto.createHmac('sha256', process.env.BL_ACCESS_TOKEN_SECRET);
          hmac.update(`${userId}:${Date.now()}`);
          const accessToken = hmac.digest('hex');

          // Something to consider: this will not inactivate previous access tokens for
          // the user on each login. Do we want to inactivate old access tokens after every
          // login so that there is always only one active access token per user at any
          // given time?

          // Store access token with the user in the database
          // TODO: If this creates a bottleneck, we should store valid access tokens in Redis
          return dbManager.getDb()
            .collection('accessTokens')
            .insertOne({ userId, accessToken })
            .then(() => [user, accessToken]);
        }
        throw new Error(errorMessage);
      })
      .then(([user, accessToken]) => (
        // Return user email and access token
        {
          email: user.email,
          accessToken,
        }
      ))
      .catch(err => {
        if (err.message === errorMessage) {
          res.status(401);
        } else {
          throw err;
        }
      });
  });
