import Joi from 'joi';

const accessToken = Joi.string().length(64);

const googleIdToken = Joi.string().regex(/^[A-Za-z0-9_.-]+$/);

const token = Joi.string().length(40);

const password = Joi.string().min(8).max(72);

const user = {
  _id: Joi.string().length(24),
  email: Joi.string().email(),

  // Joi doesn't allow empty strings by default
  firstName: Joi.string().allow(''),
  lastName: Joi.string().allow(''),
  nickname: Joi.string(),
  gender: Joi.number().integer().min(1).max(2),
  height: Joi.number().positive().max(100),
  heightUnitPreference: Joi.number().integer().min(1).max(2),
  weight: Joi.number().positive().max(1000),
  weightUnitPreference: Joi.number().integer().min(1).max(2),
  birthdate: Joi.date().iso().max('now'),
  hasOnboarded: Joi.boolean(),
  seenAppRating: Joi.boolean(),
  seenBaselineSurvey: Joi.boolean(),
  seenFeedbackSurvey: Joi.boolean(),
  lastSession: Joi.date().iso().max('now'),
  dailyStreak: Joi.number().integer().min(0),
};

const settings = {
  postureThreshold: Joi.number().min(0.03).max(0.3),
  backboneVibration: Joi.boolean(),
  phoneVibration: Joi.boolean(),
  vibrationStrength: Joi.number().min(0).max(255),
  vibrationPattern: Joi.number().integer().min(1).max(3),
  slouchTimeThreshold: Joi.number().integer().min(3).max(60),
  slouchNotification: Joi.boolean(),
};

const supportMessage = Joi.string();

const isoDate = Joi.date().iso();

export default {
  accessToken,
  googleIdToken,
  token,
  password,
  user,
  settings,
  supportMessage,
  isoDate,
};
