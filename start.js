require('babel-register');
require('localenv');

const Debug = require('debug');

Debug.enable(process.env.DEBUG);

require('./index');
