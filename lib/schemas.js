import Joi from 'joi';

const accessToken = Joi.string()
                      .length(64);

const confirmationToken = Joi.string()
                      .length(40);

const password = Joi.string()
                    // REMOVED FOR NOW
                    // .regex(/[A-Z]/, 'upper case')
                    // .regex(/[a-z]/, 'lower case')
                    .regex(/[0-9]/, 'number')
                    .min(8)
                    .max(72);

const user = {
  _id: Joi.string().length(24),
  email: Joi.string().email(),
  firstName: Joi.string(),
  lastName: Joi.string(),
  settings: Joi.object(),
};

export default {
  accessToken,
  confirmationToken,
  password,
  user,
};
