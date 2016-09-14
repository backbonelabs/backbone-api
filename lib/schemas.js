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

  // Joi doesn't allow empty strings by default
  firstName: Joi.string().allow(''),
  lastName: Joi.string().allow(''),
};

const settings = {
  postureThreshold: Joi.number().min(0.1).max(1),
  backboneVibration: Joi.boolean(),
  phoneVibration: Joi.boolean(),
  slouchTimeThreshold: Joi.number().integer().min(5).max(60),
};

export default {
  accessToken,
  confirmationToken,
  password,
  user,
  settings,
};
