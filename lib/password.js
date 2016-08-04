import bcrypt from 'bcrypt';

const saltRounds = 10;

/**
 * Hashes a password
 * @param  {String}  plainPassword The password to hash
 * @return {Promise} Resolves with the password hash
 */
const hash = plainPassword => new Promise((resolve, reject) => {
  bcrypt.hash(plainPassword, saltRounds, (err, pwHash) => {
    if (err) {
      reject(err);
    } else {
      resolve(pwHash);
    }
  });
});

/**
 * Validates a password by comparing its hash with another hash
 * @param  {String} plainPassword The plain password whose hash will be compared with pwHash
 * @param  {String} pwHash        The hash to match
 * @return {Promise} Resolves with a boolean indicating whether the password is valid
 */
const verify = (plainPassword, pwHash) => new Promise((resolve, reject) => {
  bcrypt.compare(plainPassword, pwHash, (err, isCorrectPassword) => {
    if (err) {
      reject(err);
    } else {
      resolve(isCorrectPassword);
    }
  });
});

export default { hash, verify };
