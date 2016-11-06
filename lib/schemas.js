import Joi from 'joi';

const accessToken = Joi.string()
                      .length(64);

const token = Joi.string()
                      .length(40);

const password = Joi.string()
                    .min(8)
                    .max(72);

const user = {
  _id: Joi.string().length(24),
  email: Joi.string().email(),

  // Joi doesn't allow empty strings by default
  firstName: Joi.string().allow(''),
  lastName: Joi.string().allow(''),
  nickname: Joi.string(),
  gender: Joi.number().integer().min(1).max(2),
  height: Joi.number().positive().max(100),
  weight: Joi.number().positive().max(1000),
  hasOnboarded: Joi.boolean(),
};

const settings = {
  postureThreshold: Joi.number().min(0.1).max(1),
  backboneVibration: Joi.boolean(),
  phoneVibration: Joi.boolean(),
  vibrationPattern: Joi.number().integer.min(1).max(3),
  slouchTimeThreshold: Joi.number().integer().min(5).max(60),
};

export default {
  accessToken,
  token,
  password,
  user,
  settings,
};
