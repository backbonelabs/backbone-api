require('babel-register');
require('localenv');
const Debug = require('debug');

Debug.enable(process.env.DEBUG);

const EmailUtility = require('./lib/EmailUtility').default;

EmailUtility.init({
  apiKey: process.env.BL_MAILGUN_API,
  domain: process.env.BL_MAILGUN_DOMAIN,
  fromAddress: `Backbone <hello@${process.env.BL_MAILGUN_DOMAIN}>`,
  silentEmail: process.env.BL_SILENT_EMAIL === 'true',
  useTestEmail: process.env.BL_USE_TEST_EMAIL === 'true',
  testEmail: process.env.BL_TEST_EMAIL,
});

require('./index');
