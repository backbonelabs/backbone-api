import Joi from 'joi';
import { cloneDeep } from 'lodash';

/**
 * Promisifies the Joi validation of an object schema
 * @param  {Object}     input       Object to validate
 * @param  {Joi|Object} schema      Schema used for validation that could be either a Joi type
 *                                  object or a plain object where every key is assigned a Joi
 *                                  type object
 * @param  {String[]}   [required]  Keys that are required in the input. Only works if the schema
 *                                  is a plain object where every key is assigned a Joi type object
 * @param  {String[]}   [forbidden] Keys that are not allowed in the input. Only works if the schema
 *                                  is a plain object where every key is assigned a Joi type object
 * @param  {Object}     [options]   Validation options to use
 * @return {Promise} Promise resolves with the validated input with any type conversions
 *                   and other modifiers applied by Joi, rejects with the validation error
 */
export default (input, schema, required = [], forbidden = [], options = {}) => (
  new Promise((resolve, reject) => {
    const _schema = cloneDeep(schema);

    if (!Array.isArray(required)) {
      throw new Error('The required argument must be an array of strings');
    } else if (!Array.isArray(forbidden)) {
      throw new Error('The forbidden argument must be an array of strings');
    } else if (required.length && _schema.isJoi) {
      // There are required keys, but the schema is a Joi object, no-op
    } else if (forbidden.length && _schema.isJoi) {
      // There are forbidden keys, but the schema is a Joi object, no-op
    } else {
      // Schema is a plain object where every key is assigned a Joi type object

      // Iterate through the required keys and add required() validation to the keys in the schema
      required.forEach(key => {
        if ({}.hasOwnProperty.call(_schema, key)) {
          _schema[key] = _schema[key].required();
        }
      });

      // Iterate through the forbidden keys and add forbidden() validation to the keys in the schema
      forbidden.forEach(key => {
        if ({}.hasOwnProperty.call(_schema, key)) {
          _schema[key] = _schema[key].forbidden();
        }
      });
    }

    Joi.validate(input, _schema, options, (err, value) => {
      // This is a SYNCHRONOUS callback that is invoked after validation.
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    });
  })
);
