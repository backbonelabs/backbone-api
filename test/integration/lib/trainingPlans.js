import { expect } from 'chai';
import { MongoClient } from 'mongodb';
import randomString from 'random-string';
import trainingPlans from '../../../lib/trainingPlans';

let db;

const { getTrainingPlans, mapObjectIdsToDocuments } = trainingPlans;
const testPlanName1 = randomString();
const testPlanName2 = randomString();
const testTrainingPlans = [{
  name: testPlanName1,
  levels: [
    [
      [{
        title: `${testPlanName1} Level 1 Session 1 Exercise 1`,
      }],
      [{
        title: `${testPlanName1} Level 1 Session 2 Exercise 1`,
      }],
      [{
        title: `${testPlanName1} Level 1 Session 3 Exercise 1`,
      }],
    ],
    [
      [{
        title: `${testPlanName1} Level 2 Session 1 Exercise 1`,
      }],
      [{
        title: `${testPlanName1} Level 2 Session 2 Exercise 1`,
      }],
      [{
        title: `${testPlanName1} Level 2 Session 3 Exercise 1`,
      }],
    ],
  ],
}, {
  name: testPlanName2,
  levels: [
    [
      [{
        title: `${testPlanName2} Level 1 Session 1 Exercise 1`,
      }],
      [{
        title: `${testPlanName2} Level 1 Session 2 Exercise 1`,
      }],
      [{
        title: `${testPlanName2} Level 1 Session 3 Exercise 1`,
      }],
    ],
    [
      [{
        title: `${testPlanName2} Level 2 Session 1 Exercise 1`,
      }],
      [{
        title: `${testPlanName2} Level 2 Session 2 Exercise 1`,
      }],
      [{
        title: `${testPlanName2} Level 2 Session 3 Exercise 1`,
      }],
    ],
  ],
}];

const trainingPlanFixtures = [];

before(() => (
  MongoClient.connect(process.env.BL_DATABASE_URL)
    .then((mDb) => {
      db = mDb;
    })
    .then(() => (
      db.collection('trainingPlans')
        .insertMany(testTrainingPlans)
    ))
    .then((results) => {
      const { ops } = results;
      ops.forEach(trainingPlan => trainingPlanFixtures.push(trainingPlan));
    })
));

after(() => (
  db.collection('trainingPlans')
    .deleteMany({
      _id: {
        $in: trainingPlanFixtures.map(trainingPlan => trainingPlan._id),
      },
    })
));

describe('trainingPlan module', () => {
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

  describe('mapObjectIdsToDocuments', () => {
    it('should be a function', () => {
      expect(mapObjectIdsToDocuments).to.be.a('function');
    });

    it('should return training plan documents for ObjectIDs', () => {
      const docs = mapObjectIdsToDocuments(trainingPlanFixtures.map(plan => plan._id));
      expect(docs).to.deep.equal(testTrainingPlans);
    });
  });
});
