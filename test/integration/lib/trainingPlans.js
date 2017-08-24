import { expect } from 'chai';
import randomString from 'random-string';
import cloneDeep from 'lodash/cloneDeep';
import dbManager from '../../../lib/dbManager';
import {
  fillTrainingPlanWorkouts,
  getTrainingPlans,
  getWorkouts,
  mapIdsToWorkouts,
  mapIdsToTrainingPlans,
  fillTrainingPlanWithProgress,
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
        title: `${testPlanName1} Level 1 Session 1 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }, {
        title: `${testPlanName1} Level 1 Session 1 Workout 2`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }, {
        title: `${testPlanName1} Level 1 Session 1 Workout 3`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }],
      [{
        title: `${testPlanName1} Level 1 Session 2 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }, {
        title: `${testPlanName1} Level 1 Session 2 Workout 2`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }],
      [{
        title: `${testPlanName1} Level 1 Session 3 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[2] later
      }],
    ],
    [
      [{
        title: `${testPlanName1} Level 2 Session 1 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }],
      [{
        title: `${testPlanName1} Level 2 Session 2 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }],
      [{
        title: `${testPlanName1} Level 2 Session 3 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[2] later
      }],
    ],
  ],
}, {
  name: testPlanName2,
  levels: [
    [
      [{
        title: `${testPlanName2} Level 1 Session 1 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }],
      [{
        title: `${testPlanName2} Level 1 Session 2 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }],
      [{
        title: `${testPlanName2} Level 1 Session 3 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[2] later
      }],
    ],
    [
      [{
        title: `${testPlanName2} Level 2 Session 1 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[0] later
      }],
      [{
        title: `${testPlanName2} Level 2 Session 2 Workout 1`,
        workout: null, // this will be replaced with the ObjectID of testWorkouts[1] later
      }],
      [{
        title: `${testPlanName2} Level 2 Session 3 Workout 1`,
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

describe('trainingPlans module integration tests', () => {
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

  describe('fillTrainingPlanWithProgress', () => {
    it('should be a function', () => {
      expect(fillTrainingPlanWithProgress).to.be.a('function');
    });

    it('should set isComplete to false for all session workouts if no progress is passed', () => {
      const updatedPlan = fillTrainingPlanWithProgress(cloneDeep(testTrainingPlans[0]));
      updatedPlan.levels.forEach((level) => {
        level.forEach((session) => {
          session.forEach((workout) => {
            expect(workout.isComplete).to.be.false;
          });
        });
      });
    });

    it('should set isComplete to true based on progress', () => {
      const updatedPlan = fillTrainingPlanWithProgress(cloneDeep(testTrainingPlans[0]), {
        [testTrainingPlans[0]._id]: [
          [
            [true, false, true],
            [undefined, true],
            [true],
          ],
        ],
      });
      expect(updatedPlan.levels[0][0][0]).to.have.property('isComplete', true);
      expect(updatedPlan.levels[0][0][1]).to.have.property('isComplete', false);
      expect(updatedPlan.levels[0][0][2]).to.have.property('isComplete', true);
      expect(updatedPlan.levels[0][1][0]).to.have.property('isComplete', false);
      expect(updatedPlan.levels[0][1][1]).to.have.property('isComplete', true);
      expect(updatedPlan.levels[0][2][0]).to.have.property('isComplete', true);
      expect(updatedPlan.levels[1][0][0]).to.have.property('isComplete', false);
      expect(updatedPlan.levels[1][1][0]).to.have.property('isComplete', false);
      expect(updatedPlan.levels[1][2][0]).to.have.property('isComplete', false);
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
