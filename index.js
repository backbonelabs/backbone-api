import Debug from 'debug';
import express from 'express';
import bodyParser from 'body-parser';
import dbManager from './lib/dbManager';
import authRouter from './routes/auth';
import supportRouter from './routes/support';
import usersRouter from './routes/users';

const debug = Debug('api');
const app = express();

// Disable the "X-Powered-By: Express" HTTP header
app.disable('x-powered-by');

// Parse JSON request bodies
app.use(bodyParser.json());

// Health check
app.use('/ping', (req, res) => {
  res.send('pong');
});

// Initialize database connection
export default dbManager.init({ url: process.env.BL_DATABASE_URL })
  .then(() => {
    // Register route handlers
    app.use('/auth', authRouter);
    app.use('/support', supportRouter);
    app.use('/users', usersRouter);

    const port = process.env.PORT;
    app.listen(port, () => {
      debug(`Express server listening on port ${port}`);
    });
    return app;
  })
  .catch(err => {
    debug('Error connecting to database', err);
    throw err;
  });
