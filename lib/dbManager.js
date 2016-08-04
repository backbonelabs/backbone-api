import Debug from 'debug';
import { MongoClient } from 'mongodb';

const debug = Debug('lib:mongodb');

let db;

/**
 * Initializes a database connection
 * @param  {Object}  config
 * @param  {String}  config.url     The url string to connect to
 * @param  {Object}  config.options Options supported by MongoClient.connect()
 * @return {Promise} Resolves with a database instance, rejects with a MongoError
 */
const init = config => MongoClient.connect(config.url, config.options)
  .then((mDb) => {
    debug('Connected to MongoDB');
    db = mDb;
    return mDb;
  });

/**
 * Returns the current database instance
 * @return {MongoClient} The connected database
 */
const getDb = () => db;

export default {
  init,
  getDb,
};
