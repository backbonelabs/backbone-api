const defaultSettings = {
  postureThreshold: 0.2,
};

export default {
  mergeWithDefaults(userSettings = {}) {
    return Object.assign({}, defaultSettings, userSettings);
  },
  defaults: defaultSettings,
};
