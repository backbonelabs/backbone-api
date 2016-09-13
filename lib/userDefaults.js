const profile = {
  firstName: '',
  lastName: '',
  isConfirmed: false,
};

const settings = {
  postureThreshold: 0.2,
  backboneVibration: true,
  phoneVibration: false,
  slouchTimeThreshold: 5,
};

export default {
  mergeWithDefaultSettings(userSettings = {}) {
    return Object.assign({}, settings, userSettings);
  },
  mergeWithDefaultProfile(userProfile = {}) {
    return Object.assign({}, profile, userProfile);
  },
  settings,
  profile,
};
