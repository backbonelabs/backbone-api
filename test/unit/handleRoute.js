import { expect } from 'chai';
import sinon from 'sinon';
import handleRoute from '../../lib/handleRoute';
import dbManager from '../../lib/dbManager';

describe('handleRoute', () => {
  const fakeRequest = {};
  const fakeResponse = {};

  beforeEach(() => {
    fakeResponse.send = sinon.stub();
    fakeResponse.status = sinon.stub();
    fakeResponse.statusCode = 200;
  });

  it('is a function', () => {
    expect(handleRoute).to.be.a('function');
  });

  it('returns a function', () => {
    expect(handleRoute()).to.be.a('function');
  });

  it('calls the route handler function passed into the first argument', () => {
    const routeHandler = () => Promise.resolve();
    const spy = sinon.spy(routeHandler);
    return handleRoute(spy)(fakeRequest, fakeResponse)
      .then(() => {
        expect(spy.callCount).to.equal(1);
      });
  });

  it('calls res.send with the route handler result if the result is a promise', () => {
    const result = { foo: 'bar' };
    const routeHandler = () => Promise.resolve(result);
    return handleRoute(routeHandler)(fakeRequest, fakeResponse)
      .then(() => {
        expect(fakeResponse.send.callCount).to.equal(1);
        expect(fakeResponse.send.calledWith(result)).to.be.true;
      });
  });

  it('calls res.send with the route handler result even if the result is not a promise', () => {
    const result = { foo: 'bar' };
    const routeHandler = () => result;
    return handleRoute(routeHandler)(fakeRequest, fakeResponse)
      .then(() => {
        expect(fakeResponse.send.callCount).to.equal(1);
        expect(fakeResponse.send.calledWith(result)).to.be.true;
      });
  });

  it('will handle database errors with a 500 status code', () => {
    const mongoError = new dbManager.mongodb.MongoError('Database error');
    const routeHandler = () => Promise.reject(mongoError);
    return handleRoute(routeHandler)(fakeRequest, fakeResponse)
      .then(() => {
        expect(fakeResponse.status.callCount).to.equal(1);
        expect(fakeResponse.send.callCount).to.equal(1);
        expect(fakeResponse.status.calledWith(500)).to.be.true;
        expect(fakeResponse.send.calledWithMatch({
          error: 'Unexpected database error',
        })).to.be.true;
      });
  });

  it('will handle other errors with a 400 status code', () => {
    const error = new Error('A bad error');
    const routeHandler = () => Promise.reject(error);
    return handleRoute(routeHandler)(fakeRequest, fakeResponse)
      .then(() => {
        expect(fakeResponse.status.callCount).to.equal(1);
        expect(fakeResponse.send.callCount).to.equal(1);
        expect(fakeResponse.status.calledWith(400)).to.be.true;
        expect(fakeResponse.send.calledWithMatch({
          error: error.message,
        })).to.be.true;
      });
  });

  it('will handle errors and use the status code set in the route handler', () => {
    const error = new Error('A bad error');
    const statusCode = 401;
    const routeHandler = () => {
      fakeResponse.statusCode = statusCode; // Assumes route handler called res.status()
      return Promise.reject(error);
    };
    return handleRoute(routeHandler)(fakeRequest, fakeResponse)
      .then(() => {
        expect(fakeResponse.status.callCount).to.equal(0);
        expect(fakeResponse.send.callCount).to.equal(1);
        expect(fakeResponse.send.calledWithMatch({
          error: error.message,
        })).to.be.true;
      });
  });

  it('will handle Joi validation errors', () => {
    const message = 'A Joi error';
    const joiError = new Error(message);
    joiError.name = 'ValidationError';
    joiError.details = [{
      message,
    }];
    const routeHandler = () => Promise.reject(joiError);
    return handleRoute(routeHandler)(fakeRequest, fakeResponse)
      .then(() => {
        expect(fakeResponse.status.callCount).to.equal(1);
        expect(fakeResponse.send.callCount).to.equal(1);
        expect(fakeResponse.status.calledWith(400)).to.be.true;
        expect(fakeResponse.send.calledWithMatch({
          error: message,
        })).to.be.true;
      });
  });
});
