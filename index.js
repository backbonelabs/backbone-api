import Debug from 'debug';
import express from 'express';
import bugsnag from 'bugsnag';
import bodyParser from 'body-parser';
import isInteger from 'lodash/isInteger';
import toNumber from 'lodash/toNumber';
import dbManager from './lib/dbManager';
import { getTrainingPlans, getWorkouts } from './lib/trainingPlans';
import adminRouter from './routes/admin';
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

// Report unhandledRejection error
process.on('unhandledRejection', (err, promise) => {
  debug('Possibly Unhandled Rejection at: Promise ', promise, ' reason: ', err);
  bugsnag.notify(err);
});

// Bugsnag middleware
app.use(bugsnag.requestHandler);

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
  .then(getWorkouts) // Fetch and store workouts
  .then(getTrainingPlans) // Fetch and store training plans
  .then(() => {
    // Cheap version of a cache for retrieving the latest training plan and workout data
    let cacheDuration = toNumber(process.env.BL_WORKOUT_CACHE_DURATION);
    if (isInteger(cacheDuration) && cacheDuration > 0) {
      // Convert to milliseconds
      cacheDuration *= 1000;
    } else {
      // Cache duration is not properly defined in environment variables.
      // Set to a default of 5 minutes.
      cacheDuration = 1000 * 60 * 5;
    }
    setInterval(() => {
      getWorkouts(true)
        .then(() => {
          getTrainingPlans(true);
        });
    }, cacheDuration);

    // Register route handlers
    app.use('/admin', adminRouter);
    app.use('/auth', authRouter);
    app.use('/firmware', firmwareRouter);
    app.use('/support', supportRouter);
    app.use('/users', usersRouter);
    app.use(bugsnag.errorHandler);

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
