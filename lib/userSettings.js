const defaultSettings = {
  postureThreshold: 0.2,
  backboneVibration: true,
  phoneVibration: false,
  slouchTimeThreshold: 5,
};

export default {
  mergeWithDefaults(userSettings = {}) {
    return Object.assign({}, defaultSettings, userSettings);
  },
  defaults: defaultSettings,
};
