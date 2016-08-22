import Joi from 'joi';

const accessToken = Joi.string()
                      .length(64);

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
};

export default {
  accessToken,
  password,
  user,
};
