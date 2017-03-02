module.exports = {
  extends: 'airbnb-base',
  parserOptions: {
    ecmaFeatures: {
      ecmaVersion: 6,
      experimentalObjectRestSpread: true
    }
  },
  rules: {
    'new-cap': 0,
    'max-len': [2, { code: 100 }],
    'consistent-return': [0],
    'no-console': [1],
    'no-underscore-dangle': [0],
    'prefer-template': [1],
    'comma-dangle': [2, {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'ignore',
    }],
  }
};
