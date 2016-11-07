const profile = {
  firstName: '',
  lastName: '',
  nickname: '',
  gender: null,
  height: null,
  weight: null,
  birthdate: null,
  hasOnboarded: false,
  isConfirmed: false,
};

const settings = {
  postureThreshold: 0.2,
  backboneVibration: true,
  phoneVibration: false,

  // TO DO: Update when values for vibrationStrength are finalized
  vibrationStrength: 0.1,

  vibrationPattern: 1,
  slouchTimeThreshold: 5,
};

export default {
  mergeWithDefaultData(user) {
    return Object.assign({}, { settings }, profile, user);
  },
  settings,
  profile,
};
