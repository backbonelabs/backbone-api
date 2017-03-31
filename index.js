import Debug from 'debug';
import express from 'express';
import bugsnag from 'bugsnag';
import bodyParser from 'body-parser';
import dbManager from './lib/dbManager';
import authRouter from './routes/auth';
import firmwareRouter from './routes/firmware';
import supportRouter from './routes/support';
import usersRouter from './routes/users';

const debug = Debug('api');
const app = express();

// Register bugsnag api key
bugsnag.register(process.env.BL_BUGSNAG_API_KEY);

// Report uncaughtException error
process.on('uncaughtException', (err) => {
  bugsnag.notify(err);
});

// Disable the "X-Powered-By: Express" HTTP header
app.disable('x-powered-by');

// Parse JSON request bodies
app.use(bodyParser.json());

// Health check
app.use('/ping', (req, res) => {
  res.send('pong');
});

// Initialize database connection
export default dbManager.init({
  url: process.env.BL_DATABASE_URL,
  options: {
    db: {
      readPreference: dbManager.mongodb.ReadPreference.PRIMARY_PREFERRED,
    },
  },
})
  .then(() => {
    // Register route handlers
    app.use('/auth', authRouter);
    app.use('/firmware', firmwareRouter);
    app.use('/support', supportRouter);
    app.use('/users', usersRouter);

    const port = process.env.PORT;
    app.listen(port, () => {
      debug(`Express server listening on port ${port}`);
    });
    return app;
  })
  .catch((err) => {
    debug('Error connecting to database', err);
    throw err;
  });
