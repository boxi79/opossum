const CircuitBreaker = require('../lib/circuit');
const { timedFailingFunction, timedFunction } = require('../test/common');

describe('Gradually half-open test', () => {
  beforeEach(() => {
    Math.random = jest.fn();
    Math.random.mockReturnValue(0);
  });
  it('should open if cannot pass half-open error rate.', done => {
    const options = {
      errorThresholdPercentage: 1,
      resetTimeout: 100,
      halfOpenStages: [0.5 , 1],
      permittedNumberOfCallsInHalfOpenState: 3,
    };
    const breaker = new CircuitBreaker(timedFailingFunction, options);

    expect.assertions(8);
    const pendingPromise = breaker.fire(1);
    
    // should switch to open state
    pendingPromise
      .catch(e => expect(e).toBe('Failed after 1'))
      .then(() => {
        expect(breaker.opened).toBeTruthy();
        expect(breaker.pendingClose).toBeFalsy();
      });

    // 1. After timetout, should go back to half open.
    // 2. If fail for first stage, go back to open.
    setTimeout(() => {
      expect(breaker.halfOpen).toBeTruthy();
      expect(breaker.pendingClose).toBeTruthy();
      breaker.fire(1).catch(() => {
        breaker.fire(1).catch(() => {
          breaker.fire(1).catch(e => {
            expect(e).toEqual('Failed after 1');
            expect(breaker.halfOpen).toBeFalsy();
            expect(breaker.opened).toBeTruthy();
            done();
          });
        });
      });
    }, options.resetTimeout * 1.5);
  });
  it('should close if can pass half-open stages and error rate.', done => {
    const options = {
      errorThresholdPercentage: 1,
      resetTimeout: 100,
      halfOpenStages: [0.5, 1],
      permittedNumberOfCallsInHalfOpenState: 3,
    };

    const mockTestFunc = jest.fn();
    mockTestFunc
      .mockImplementationOnce(time => timedFailingFunction(time))
      .mockImplementationOnce(time => timedFunction(time))
      .mockImplementationOnce(time => timedFunction(time))
      .mockImplementationOnce(time => timedFunction(time))
      .mockImplementationOnce(time => timedFunction(time))
      .mockImplementationOnce(time => timedFunction(time))
      .mockImplementationOnce(time => timedFunction(time));

    expect.assertions(7);
      
    const breaker = new CircuitBreaker(mockTestFunc, options);

    const pendingPromise = breaker.fire(1);
    
    // should switch to open state
    pendingPromise
    .catch(e => expect(e).toBe('Failed after 1'))
    .then(() => {
      expect(breaker.opened).toBeTruthy();
      expect(breaker.pendingClose).toBeFalsy();
    });

    // 1. After timetout, should go back to half open
    // 2. If pass for all stage, go back to close.
    setTimeout(() => {
      expect(breaker.halfOpen).toBeTruthy();
      expect(breaker.pendingClose).toBeTruthy();
      breaker.fire(1).then(() => {
        breaker.fire(1).then(() => {
          breaker.fire(1).then(() => {
            breaker.fire(1).then(() => {
              breaker.fire(1).then(() => {
                breaker.fire(1).then(() => {
                  expect(breaker.halfOpen).toBeFalsy();
                  expect(breaker.closed).toBeTruthy();
                  done();
                });
              });
            });
          });
        });
      });
    }, options.resetTimeout * 1.5);
  });
});