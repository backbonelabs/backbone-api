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

  // Create a deep clone of trainingPlan to inject workout objects into and to fill
  // in with details for the training plan
  const clone = cloneDeep(trainingPlan);
  const difficulties = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
  const types = ['Posture Session', 'Exercise', 'Stretch', 'Mobility'];
  clone.levels.forEach((level) => {
    level.forEach((session) => {
      session.forEach((sessionItem) => {
        const workout = workoutHash[sessionItem.workout];
        /* eslint-disable no-param-reassign */
        // Replace workout ID with the full workout object in the session
        sessionItem.workout = workout;

        if (!sessionItem.title) {
          // A title doesn't exist for the workout when shown from the training plan
          // so generate the title based on the difficulty, muscle group, and type
          // of the workout
          const title = [];
          if (workout.difficulty && difficulties[workout.difficulty]) {
            title.push(difficulties[workout.difficulty]);
          }
          if (workout.muscle) title.push(workout.muscle);
          if (workout.type && types[workout.type]) title.push(types[workout.type]);
          sessionItem.title = title.join(' ');
        }
        /* eslint-enable no-param-reassign */
      });
    });
  });

  return clone;
};

const fillTrainingPlanWithProgress = (plan = { levels: [] }, progress = {}) => {
  const updatedPlan = cloneDeep(plan);
  // First mark all workouts in the plan as incomplete
  updatedPlan.levels.forEach((level) => {
    level.forEach((session) => {
      session.forEach((sessionItem) => {
        // eslint-disable-next-line no-param-reassign
        sessionItem.isComplete = false;
      });
    });
  });

  // Iterate through progress blob and update the incomplete flags based on the progress statuses
  if (updatedPlan._id && progress[updatedPlan._id]) {
    forEach(progress[updatedPlan._id], (level, levelIdx) => {
      forEach(level, (session, sessionIdx) => {
        forEach(session, (workoutResult, workoutIdx) => {
          updatedPlan.levels[levelIdx][sessionIdx][workoutIdx].isComplete = !!workoutResult;
        });
      });
    });
  }

  return updatedPlan;
};

/**
 * Returns full trainingPlan documents for Mongo ObjectIDs of the trainingPlan collection
 * @param  {ObjectID[]} objectIds            trainingPlan collection ObjectIDs
 * @param  {Object}     trainingPlanProgress Training plan progress for a user
 * @return {Object[]} Full trainingPlan documents matching the ObjectIDs
 */
const mapIdsToTrainingPlans = (objectIds = [], trainingPlanProgress = {}) => (
  objectIds.reduce((mappedTrainingPlans, objectId) => {
    const idString = objectId.toHexString();
    const matchingPlan = _trainingPlans.find(plan => plan._id.toHexString() === idString);
    if (matchingPlan) {
      mappedTrainingPlans.push(
        fillTrainingPlanWithProgress(fillTrainingPlanWorkouts(matchingPlan), trainingPlanProgress));
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
  fillTrainingPlanWithProgress,
};
