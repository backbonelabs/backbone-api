module.exports = {
  extends: 'airbnb-base',
  env: {
    mocha: true
  },
  rules: {
    'import/no-extraneous-dependencies': [2, { devDependencies: true }],
    'new-cap': 0,
    'no-underscore-dangle': 0,
    'no-unused-expressions': 0
  }
};
