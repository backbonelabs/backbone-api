import Joi from 'joi';

const dbId = Joi.string().length(24);

const accessToken = Joi.string().length(64);

const googleIdToken = Joi.string().regex(/^[A-Za-z0-9_.-]+$/);

const token = Joi.string().length(40);

const password = Joi.string().min(8).max(72);

const facebook = {
  accessToken: Joi.string().token(),
  applicationID: Joi.number().integer(),
  id: Joi.number().integer(),
  verified: Joi.bool(),
};

const user = {
  _id: dbId,
  email: Joi.string().email({ minDomainAtoms: 2 }),

  // Joi doesn't allow empty strings by default
  firstName: Joi.string().allow(''),
  lastName: Joi.string().allow(''),
  nickname: Joi.string(),
  gender: Joi.number().integer().min(1).max(3),
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
  favoriteWorkouts: Joi.array().items(dbId),
  trainingPlanProgress: Joi.object().pattern(/\w+/, Joi.array()
                                                       .items(Joi.array()
                                                         .items(Joi.array()
                                                           .items(Joi.boolean(), Joi.empty())
                                                          )
                                                        )),
};

const settings = {
  postureThreshold: Joi.number().min(0.03).max(0.3),
  backboneVibration: Joi.boolean(),
  phoneVibration: Joi.boolean(),
  vibrationStrength: Joi.number().integer().min(0).max(255),
  vibrationPattern: Joi.number().integer().min(1).max(3),
  slouchTimeThreshold: Joi.number().integer().min(3).max(60),
  slouchNotification: Joi.boolean(),
};

const supportMessage = Joi.string();

const isoDate = Joi.date().iso();

export default {
  accessToken,
  facebook,
  googleIdToken,
  token,
  password,
  user,
  settings,
  supportMessage,
  isoDate,
};
