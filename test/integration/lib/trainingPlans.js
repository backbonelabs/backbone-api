import { expect } from 'chai';
import randomString from 'random-string';
import dbManager from '../../../lib/dbManager';
import {
  fillTrainingPlanWorkouts,
  getTrainingPlans,
  getWorkouts,
  mapIdsToWorkouts,
  mapIdsToTrainingPlans,
} from '../../../lib/trainingPlans';

let db;

const testWorkoutName1 = randomString();
const testWorkoutName2 = randomString();
const testWorkoutName3 = randomString();
const testWorkouts = [{
  title: testWorkoutName1,
}, {
  title: testWorkoutName2,
}, {
  title: testWorkoutName3,
}];
const testPlanName1 = randomString();
const testPlanName2 = randomString();
const testTrainingPlans = [{
  name: testPlanName1,
  levels: [
    [
      [{
        title: `${testPlanName1} Level 1 Session 1 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }],
      [{
        title: `${testPlanName1} Level 1 Session 2 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }],
      [{
        title: `${testPlanName1} Level 1 Session 3 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[2] later
      }],
    ],
    [
      [{
        title: `${testPlanName1} Level 2 Session 1 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }],
      [{
        title: `${testPlanName1} Level 2 Session 2 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }],
      [{
        title: `${testPlanName1} Level 2 Session 3 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[2] later
      }],
    ],
  ],
}, {
  name: testPlanName2,
  levels: [
    [
      [{
        title: `${testPlanName2} Level 1 Session 1 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }],
      [{
        title: `${testPlanName2} Level 1 Session 2 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }],
      [{
        title: `${testPlanName2} Level 1 Session 3 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[2] later
      }],
    ],
    [
      [{
        title: `${testPlanName2} Level 2 Session 1 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }],
      [{
        title: `${testPlanName2} Level 2 Session 2 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }],
      [{
        title: `${testPlanName2} Level 2 Session 3 Exercise 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[2] later
      }],
    ],
  ],
}];

before(() => (
  dbManager.init({ url: process.env.BL_DATABASE_URL })
    .then((mDb) => {
      db = mDb;
    })
    .then(() => (
      // Insert test workouts
      db.collection('workouts')
        .insertMany(testWorkouts)
    ))
    .then(() => {
      // Reference the test workout IDs in the test training plan sessions.
      // The .insertMany call will mutate testWorkouts to add _id to each workout
      testTrainingPlans.forEach((trainingPlan) => {
        trainingPlan.levels.forEach((level) => {
          level.forEach((session, idx) => {
            session.forEach((sessionItem) => {
              sessionItem.workout = testWorkouts[idx]._id;
            });
          });
        });
      });
    })
    .then(() => (
      // Insert test training plans
      db.collection('trainingPlans')
        .insertMany(testTrainingPlans)
    ))
));

after(() => (
  // Delete test training plans
  db.collection('trainingPlans')
    .deleteMany({
      _id: {
        $in: testTrainingPlans.map(trainingPlan => trainingPlan._id),
      },
    })
    .then(() => (
      // Delete test workouts
      db.collection('workouts')
        .deleteMany({
          _id: {
            $in: testWorkouts.map(workout => workout._id),
          },
        })
    ))
));

describe('trainingPlans module', () => {
  describe('getTrainingPlans', () => {
    it('should be a function', () => {
      expect(getTrainingPlans).to.be.a('function');
    });

    it('should resolve an array of training plans', () => (
      getTrainingPlans(true)
        .then((results) => {
          expect(results).to.be.an('array');
          const planNames = results.map(plan => plan.name);
          expect(planNames).to.include.members([testPlanName1, testPlanName2]);
        })
    ));
  });

  describe('getWorkouts', () => {
    it('should be a function', () => {
      expect(getWorkouts).to.be.a('function');
    });

    it('should resolve an array of training plans', () => (
      getWorkouts(true)
        .then((results) => {
          expect(results).to.be.an('array');
          const workoutTitles = results.map(workout => workout.title);
          expect(workoutTitles).to.include.members([
            testWorkoutName1,
            testWorkoutName2,
            testWorkoutName3,
          ]);
        })
    ));
  });

  describe('fillTrainingPlanWorkouts', () => {
    it('should be a function', () => {
      expect(fillTrainingPlanWorkouts).to.be.a('function');
    });

    it('should return a training plan with workout documents', () => {
      const testWorkoutNames = [testWorkoutName1, testWorkoutName2, testWorkoutName3];
      const trainingPlan = fillTrainingPlanWorkouts(testTrainingPlans[0]);
      trainingPlan.levels.forEach((level) => {
        level.forEach((session, sessionIdx) => {
          session.forEach((sessionItem) => {
            expect(sessionItem.workout._id.toHexString())
              .to.equal(testWorkouts[sessionIdx]._id.toHexString());
            expect(sessionItem.workout.title).to.equal(testWorkoutNames[sessionIdx]);
          });
        });
      });
    });
  });

  describe('mapIdsToWorkouts', () => {
    it('should be a function', () => {
      expect(mapIdsToWorkouts).to.be.a('function');
    });

    it('should return an array of workout documents for ObjectIDs', () => {
      const oneWorkout = mapIdsToWorkouts([testWorkouts[0]._id]);
      expect(oneWorkout).to.deep.equal([testWorkouts[0]]);

      const allWorkouts = mapIdsToWorkouts(testWorkouts.map(workout => workout._id));
      expect(allWorkouts).to.deep.equal(testWorkouts);
    });
  });

  describe('mapIdsToTrainingPlans', () => {
    it('should be a function', () => {
      expect(mapIdsToTrainingPlans).to.be.a('function');
    });

    it('should return an array of training plan documents for ObjectIDs', () => {
      const trainingPlans = mapIdsToTrainingPlans(testTrainingPlans.map(plan => plan._id));

      const testWorkoutNames = [testWorkoutName1, testWorkoutName2, testWorkoutName3];
      trainingPlans.forEach((trainingPlan, docIdx) => {
        expect(trainingPlan.name).to.equal(testTrainingPlans[docIdx].name);

        trainingPlan.levels.forEach((level, levelIdx) => {
          level.forEach((session, sessionIdx) => {
            session.forEach((sessionItem, sessionItemIdx) => {
              // Assert session item title
              expect(sessionItem.title)
                .to.equal(
                  testTrainingPlans[docIdx].levels[levelIdx][sessionIdx][sessionItemIdx].title);

              // Assert workout details
              expect(sessionItem.workout._id.toHexString())
                .to.equal(testWorkouts[sessionIdx]._id.toHexString());

              expect(sessionItem.workout.title).to.equal(testWorkoutNames[sessionIdx]);
            });
          });
        });
      });
    });
  });
});
