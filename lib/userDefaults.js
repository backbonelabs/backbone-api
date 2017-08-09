import constants from './constants';

const profile = {
  firstName: '',
  lastName: '',
  nickname: '',
  gender: null,
  height: null,
  heightUnitPreference: constants.heightUnits.IN,
  weight: null,
  weightUnitPreference: constants.weightUnits.LB,
  birthdate: null,
  hasOnboarded: false,
  seenAppRating: false,
  seenBaselineSurvey: false,
  seenFeedbackSurvey: false,
  isConfirmed: false,
  lastSession: null,
  dailyStreak: 0,
  authMethod: constants.authMethods.EMAIL,
  favoriteWorkouts: [],
};

const settings = {
  postureThreshold: 0.2,
  backboneVibration: true,
  phoneVibration: true,
  vibrationStrength: 60,
  vibrationPattern: 1,
  slouchTimeThreshold: 5,
  slouchNotification: true,
};

export default {
  mergeWithDefaultData(user) {
    return Object.assign({}, { settings }, profile, user);
  },
  settings,
  profile,
};
