import Joi from 'joi';

/**
 * Promisifies the Joi validation of an object schema
 * @param  {Object}     input     Object to validate
 * @param  {Joi|Object} schema    Joi type object or plain object to use as the schema
 *                                for validation
 * @param  {Object}     [options] Validation options to use
 * @return {Promise} Promise resolves with the validated input with any type conversions
 *                   and other modifiers applied by Joi, rejects with the validation error
 */
export default (input, schema, options = {}) => new Promise((resolve, reject) => {
  Joi.validate(input, schema, options, (err, value) => {
    // This is a SYNCHRONOUS callback that is invoked after validation.
    if (err) {
      reject(err);
    } else {
      resolve(value);
    }
  });
});
