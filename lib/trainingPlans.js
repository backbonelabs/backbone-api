import Debug from 'debug';
import cloneDeep from 'lodash/cloneDeep';
import forEach from 'lodash/forEach';
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
 * Replaces workout Mongo ObjectIDs in a training plan with the full workout document
 * @param  {Object} trainingPlan
 * @return {Object} A new object representing the training plan with the full workout details
 */
const fillTrainingPlanWorkouts = (trainingPlan = {}) => {
  if (!Object.prototype.hasOwnProperty.call(trainingPlan, 'levels') ||
    !Array.isArray(trainingPlan.levels)) {
    // trainingPlan does not have a `levels` property or it is not an array
    return trainingPlan;
  }

  // Traverse training plan to find workout IDs
  const workoutHash = {};
  trainingPlan.levels.forEach((level) => {
    level.forEach((session) => {
      session.forEach((sessionItem) => {
        if (sessionItem.workout) {
          workoutHash[sessionItem.workout.toHexString()] = true;
        }
      });
    });
  });

  // Add workout object to workoutHash for each workout ID
  forEach(workoutHash, (value, workoutId) => {
    workoutHash[workoutId] = _workouts.find(workout => workout._id.toHexString() === workoutId);
  });

  // Create a deep clone of trainingPlan to inject workout objects into
  const clone = cloneDeep(trainingPlan);
  clone.levels.forEach((level) => {
    level.forEach((session) => {
      session.forEach((sessionItem) => {
        // eslint-disable-next-line no-param-reassign
        sessionItem.workout = workoutHash[sessionItem.workout];
      });
    });
  });

  return clone;
};

/**
 * Returns full trainingPlan documents for Mongo ObjectIDs of the trainingPlan collection
 * @param  {ObjectID[]} objectIds trainingPlan collection ObjectIDs
 * @return {Object[]} Full trainingPlan documents matching the ObjectIDs
 */
const mapIdsToTrainingPlans = (objectIds = []) => (
  objectIds.reduce((mappedTrainingPlans, objectId) => {
    const idString = objectId.toHexString();
    const matchingPlan = _trainingPlans.find(plan => plan._id.toHexString() === idString);
    if (matchingPlan) {
      mappedTrainingPlans.push(fillTrainingPlanWorkouts(matchingPlan));
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
const mapIdsToWorkouts = (objectIds = []) => (
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
  mapIdsToTrainingPlans,
  mapIdsToWorkouts,
  fillTrainingPlanWorkouts,
};
