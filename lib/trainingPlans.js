import Debug from 'debug';
import dbManager from './dbManager';

const debug = Debug('lib:trainingPlans');

let _trainingPlans = [];

/**
 * Retrieves training plans from database and caches them in memory
 * @param  {Boolean} [force = false] Force a database query to retrieve latest info
 * @return {Promise<Array>} Resolves with the training plans
 */
const getTrainingPlans = (force = false) => {
  if (_trainingPlans.length && !force) {
    debug('Cache hit');
    return Promise.resolve(_trainingPlans);
  }

  debug('Fetching training plans from database');
  return dbManager.getDb()
    .collection('trainingPlans')
    .find({})
    .toArray()
    .then((trainingPlans) => {
      debug('Training plans', trainingPlans);
      _trainingPlans = trainingPlans;
      return trainingPlans;
    });
};

/**
 * Returns full trainingPlan documents for Mongo ObjectIDs
 * @param  {ObjectID[]} objectIds
 * @return {Object[]} Full trainingPlan documents matching the ObjectIDs
 */
const mapObjectIdsToDocuments = (objectIds = []) => (
  objectIds.reduce((mappedTrainingPlans, objectId) => {
    const idString = objectId.toHexString();
    const matchingPlan = _trainingPlans.find(plan => plan._id.toHexString() === idString);
    if (matchingPlan) {
      mappedTrainingPlans.push(matchingPlan);
    }
    return mappedTrainingPlans;
  }, [])
);

export default { getTrainingPlans, mapObjectIdsToDocuments };
