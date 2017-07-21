import Debug from 'debug';
import dbManager from './dbManager';

const debug = Debug('lib:trainingPlans');

let _trainingPlans = [];
let _workouts = [];

/**
 * Retrieves training plans from database and caches them in memory
 * @param  {Boolean} [force = false] Force a database query to retrieve latest info
 * @return {Promise<Array>} Resolves with the training plans
 */
const getTrainingPlans = (force = false) => {
  if (_trainingPlans.length && !force) {
    debug('Training plan cache hit');
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
 * Returns full trainingPlan documents for Mongo ObjectIDs of the trainingPlan collection
 * @param  {ObjectID[]} objectIds trainingPlan collection ObjectIDs
 * @return {Object[]} Full trainingPlan documents matching the ObjectIDs
 */
const mapTrainingPlanIdsToDocuments = (objectIds = []) => (
  objectIds.reduce((mappedTrainingPlans, objectId) => {
    const idString = objectId.toHexString();
    const matchingPlan = _trainingPlans.find(plan => plan._id.toHexString() === idString);
    if (matchingPlan) {
      mappedTrainingPlans.push(matchingPlan);
    }
    return mappedTrainingPlans;
  }, [])
);

/**
 * Retrieves workouts from database and caches them in memory
 * @param  {Boolean} [force = false] Force a database query to retrieve latest info
 * @return {Promise<Array>} Resolves with the workouts
 */
const getWorkouts = (force = false) => {
  if (_workouts.length && !force) {
    debug('Workout cache hit');
    return Promise.resolve(_workouts);
  }

  debug('Fetching workouts from database');
  return dbManager.getDb()
    .collection('workouts')
    .find({})
    .toArray()
    .then((workouts) => {
      debug('Workouts', workouts);
      _workouts = workouts;
      return workouts;
    });
};

/**
 * Returns full workout documents for Mongo ObjectIDs of the workout collection
 * @param  {ObjectID[]} objectIds workout collection ObjectIDs
 * @return {Object[]} Full workout documents matching the ObjectIDs
 */
const mapWorkoutIdsToDocuments = (objectIds = []) => (
  objectIds.reduce((mappedWorkouts, objectId) => {
    const idString = objectId.toHexString();
    const matchingWorkout = _workouts.find(workout => workout._id.toHexString() === idString);
    if (matchingWorkout) {
      mappedWorkouts.push(matchingWorkout);
    }
    return mappedWorkouts;
  }, [])
);

export {
  getTrainingPlans,
  getWorkouts,
  mapTrainingPlanIdsToDocuments,
  mapWorkoutIdsToDocuments,
};
