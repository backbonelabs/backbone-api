const profile = {
  firstName: '',
  lastName: '',
};

const settings = {
  postureThreshold: 0.2,
  backboneVibration: true,
  phoneVibration: false,
  slouchTimeThreshold: 5,
};

export default {
  mergeWithDefaultData(user = {}) {
    return Object.assign({}, { settings }, profile, user);
  },
  settings,
  profile,
};
