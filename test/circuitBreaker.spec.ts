import { CircuitBreaker } from '../src/index';

const successPromise = (value: string) => Promise.resolve(value);
const failurePromise = (timeout: number, error: Error) => new Promise((_, reject) => setTimeout(() => reject(error), timeout));
const timeoutPromise = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout));

describe('CircuitBreaker', () => {

    describe('execute', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 100, resetTimeout: 5 });
        });

        test('should execute successfully', async () => {
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).resolves.toBe('success');
        });

        test('should throw error on timeout', async () => {
            const promise = () => timeoutPromise(110);
            await expect(breaker.execute(promise)).rejects.toThrow('Operation timed out');
        });

        test('should set state to OPEN on failure', async () => {
            const promise = () => failurePromise(5, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(breaker.isOpen()).toBe(true);
            await timeoutPromise(5);
            expect(breaker.isHalfOpen()).toBe(true);
            await breaker.execute(() => successPromise('success'));
            expect(breaker.isClosed()).toBe(true);
        });

        test('should throw error when circuit is OPEN', async () => {
            breaker.open();
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).rejects.toThrow('Circuit is open');
        });

        test('should not sum error when circuit is OPEN', async () => {
            breaker.open();
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).rejects.toThrow('Circuit is open');
            expect(breaker.successCount).toBe(0);
            expect(breaker.failureCount).toBe(0);
            expect(breaker.totalRequests).toBe(0);
            expect(breaker.failurePercentage).toBe(0);
        });

        test('should pass 1 execution when circuit is HALF_OPEN', async () => {
            breaker.halfOpen();
            const successMock = jest.fn();
            const rejectMock = jest.fn();
            breaker.event.on('success', successMock);
            breaker.event.on('reject', rejectMock);

            const promise = () => timeoutPromise(1);

            await Promise.allSettled([
                breaker.execute(promise),
                breaker.execute(promise),
                breaker.execute(promise),
            ]);

            expect(successMock).toHaveBeenCalledTimes(1);
            expect(rejectMock).toHaveBeenCalledTimes(2);
        });

        test('should pass 1 execution when circuit is HALF_OPEN', (done) => {
            breaker.halfOpen();
            const successMock = jest.fn();
            const rejectMock = jest.fn();
            const errorMock = jest.fn();
            breaker.event.on('success', successMock);
            breaker.event.on('reject', rejectMock);
            breaker.event.on('error', errorMock);

            const failPromise = () => failurePromise(5, new Error('failure'));
            const promise = () => timeoutPromise(5);

            Promise.allSettled([
                breaker.execute(failPromise),
                breaker.execute(failPromise),
            ]).finally(() => {
                setTimeout(async () => {
                    await breaker.execute(promise);

                    expect(breaker.isClosed()).toBe(true);
                    expect(successMock).toHaveBeenCalledTimes(1);
                    expect(rejectMock).toHaveBeenCalledTimes(1);
                    expect(errorMock).toHaveBeenCalledTimes(1);
                    done();
                }, 10);
            })
        });

        test('should pass 1 execution when circuit is HALF_OPEN in 2 executions', async () => {
            breaker.halfOpen();
            const successMock = jest.fn();
            const rejectMock = jest.fn();
            breaker.event.on('success', successMock);
            breaker.event.on('reject', rejectMock);

            const promise = () => timeoutPromise(5);

            await Promise.allSettled([
                breaker.execute(promise),
                breaker.execute(promise),
                breaker.execute(promise),
            ]);

            await Promise.allSettled([
                breaker.execute(promise),
                breaker.execute(promise),
                breaker.execute(promise),
            ]);

            expect(successMock).toHaveBeenCalledTimes(4);
            expect(rejectMock).toHaveBeenCalledTimes(2);
        });

        test('should fail when passing a Promise instead of a function', async () => {
            const promise = successPromise('success') as any;
            await expect(breaker.execute(promise)).rejects.toThrow(
                'Invalid argument: Expected a function that returns a Promise. Ensure you are passing a function, not a Promise.'
            );
        });
    });

    describe('timeout', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 100 });
        });

        test('should execute successfully', async () => {
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).resolves.toBe('success');
        });

        test('should throw error on timeout', async () => {
            const promise = () => timeoutPromise(200);
            await expect(breaker.execute(promise)).rejects.toThrow('Operation timed out');
        });

        test('should set state to OPEN on failure', async () => {
            const promise = () => failurePromise(10, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(breaker.isOpen()).toBe(true);
        });
    });

    describe('resetTimeout', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 50 });
        });

        test('shoud reset timeout after open', (done) => {
            breaker.open();
            expect(breaker.isOpen()).toBe(true);

            setTimeout(() => {
                expect(breaker.isHalfOpen()).toBe(true);
                done();
            }, 51);
        });

        test('shoud not reset timeout when resetTimeout is undefined', (done) => {
            breaker = new CircuitBreaker({ timeout: 10 });
            breaker.open();
            expect(breaker.isOpen()).toBe(true);

            setTimeout(() => {
                expect(breaker.isOpen()).toBe(true);
                done();
            }, 51);
        });
    });

    describe('state transitions', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 5 });
        });

        test('should transition from HALF_OPEN to CLOSE on successful request', async () => {
            breaker.halfOpen();
            expect(breaker.isHalfOpen()).toBe(true);
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).resolves.toBe('success');
            expect(breaker.isClosed()).toBe(true);
        });

        test('should transition from HALF_OPEN to OPEN on failed request', async () => {
            breaker.halfOpen();
            expect(breaker.isHalfOpen()).toBe(true);
            const promise = () => failurePromise(5, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(breaker.isOpen()).toBe(true);
        });

        test('should reset state to HALF_OPEN after resetTimeout', async () => {
            breaker.open();
            await timeoutPromise(10);
            expect(breaker.isHalfOpen()).toBe(true);
        });
    });

    describe('state transitions with default options', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({});
        });

        test('should not throw timeout exeption when timeout is undefined', async () => {
            const promise = () => timeoutPromise(50);
            await breaker.execute(promise);
            expect(breaker.isClosed()).toBe(true);
        });
    });

    describe('isError', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({
                timeout: 100,
                resetTimeout: 5,
                isError: (err) => err.message !== 'non-critical error',
            });
        });

        test('should execute successfully', async () => {
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).resolves.toBe('success');
        });

        test('should not consider non-critical error as a failure', async () => {
            const promise = () => failurePromise(5, new Error('non-critical error'));
            await expect(breaker.execute(promise)).rejects.toThrow('non-critical error');
            expect(breaker.isOpen()).toBe(false);
        });

        test('should consider critical error as a failure', async () => {
            const promise = () => failurePromise(5, new Error('critical error'));
            await expect(breaker.execute(promise)).rejects.toThrow('critical error');
            expect(breaker.isOpen()).toBe(true);
        });

        test('should throw error when circuit is open', async () => {
            breaker.open();
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).rejects.toThrow('Circuit is open');
        });

        test('should re-throw error and open circuit for critical error', async () => {
            const errorEventMock = jest.fn();
            breaker.event.on('error', errorEventMock);

            const criticalError = new Error('critical error');
            const promise = () => failurePromise(5, criticalError);

            await expect(breaker.execute(promise)).rejects.toThrow('critical error');

            expect(errorEventMock).toHaveBeenCalledWith(criticalError);

            expect(breaker.isOpen()).toBe(true);
        });
    });

    describe('events', () => {
        let breaker: CircuitBreaker;
        let openListener: jest.Mock;
        let closeListener: jest.Mock;
        let halfOpenListener: jest.Mock;
        let successListener: jest.Mock;
        let errorListener: jest.Mock;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 5 });
            openListener = jest.fn();
            closeListener = jest.fn();
            halfOpenListener = jest.fn();
            successListener = jest.fn();
            errorListener = jest.fn();

            breaker.event.on('open', openListener);
            breaker.event.on('close', closeListener);
            breaker.event.on('halfOpen', halfOpenListener);
            breaker.event.on('success', successListener);
            breaker.event.on('error', errorListener);
        });

        test('should emit open event', async () => {
            const promise = () => failurePromise(5, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(openListener).toHaveBeenCalled();
        });

        test('should emit close event', async () => {
            breaker.halfOpen();
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).resolves.toBe('success');
            expect(closeListener).toHaveBeenCalled();
        });

        test('should emit halfOpen event', async () => {
            breaker.open();
            await timeoutPromise(11);
            expect(halfOpenListener).toHaveBeenCalled();
        });

        test('should emit success event', async () => {
            const promise = () => successPromise('success');
            await expect(breaker.execute(promise)).resolves.toBe('success');
            expect(successListener).toHaveBeenCalledWith('success');
        });

        test('should emit error event', async () => {
            const promise = () => failurePromise(5, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('autoRenewAbortController', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 50, autoRenewAbortController: true });
        });

        test('shoud renew AbortController timeout after HALF_OPEN', (done) => {
            const oldSignal = breaker.signal;
            breaker.open();

            setTimeout(async () => {
                expect(breaker.isHalfOpen()).toBe(true);
                const newSignal = breaker.signal;
                expect(oldSignal?.aborted).toBe(true);
                expect(newSignal?.aborted).toBe(false);
                done();
            }, 51);
        });

        test('shoud renew AbortController timeout after OPEN', (done) => {
            const oldSignal = breaker.signal;
            breaker.open();

            setTimeout(async () => {
                const promise = () => successPromise('success');
                await expect(breaker.execute(promise)).resolves.toBe('success');
                expect(breaker.isClosed()).toBe(true);
                const newSignal = breaker.signal;
                expect(oldSignal?.aborted).toBe(true);
                expect(newSignal?.aborted).toBe(false);
                done();
            }, 51);
        });
    });

    describe('failureThresholdCount', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 100, failureThresholdCount: 3 });
        });

        test('should set state to OPEN on max failureThresholdCount', async () => {
            const promise = () => successPromise('success');
            const failPromise = () => Promise.reject('failure');

            await Promise.all(Array.from({ length: 100 }).map(() => breaker.execute(promise)));
            await Promise.allSettled([
                breaker.execute(failPromise),
                breaker.execute(failPromise),
            ]);

            expect(breaker.isClosed()).toBe(true);
        });

        test('should set state to OPEN on max failureThresholdCount', async () => {
            const promise = () => successPromise('success');
            const failPromise = () => Promise.reject('failure');

            await Promise.all(Array.from({ length: 100 }).map(() => breaker.execute(promise)));
            await Promise.allSettled([
                breaker.execute(failPromise),
                breaker.execute(failPromise),
                breaker.execute(failPromise),
            ]);

            expect(breaker.isOpen()).toBe(true);
        });

        test('should set state to OPEN passing max failureThresholdCount', async () => {
            const promise = () => successPromise('success');
            const failPromise = () => Promise.reject('failure');

            await Promise.all(Array.from({ length: 100 }).map(() => breaker.execute(promise)));
            await Promise.allSettled([
                breaker.execute(failPromise),
                breaker.execute(failPromise),
                breaker.execute(failPromise),
                breaker.execute(failPromise),
            ]);

            expect(breaker.isOpen()).toBe(true);
        });
    });

    describe('successThreshold', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 100, successThreshold: 2 });
        });

        test('should remain in HALF_OPEN state when successThreshold is below limit', async () => {
            const promise = () => successPromise('success');
            breaker.halfOpen();

            await breaker.execute(promise);

            expect(breaker.isHalfOpen()).toBe(true);
        });

        test('should transition to CLOSED state when reaching successThreshold limit', async () => {
            const promise = () => successPromise('success');
            breaker.halfOpen();

            await breaker.execute(promise);
            await breaker.execute(promise);

            expect(breaker.isClosed()).toBe(true);
        });

        test('should transition to CLOSED state when exceeding successThreshold limit', async () => {
            const promise = () => successPromise('success');
            breaker.halfOpen();

            await breaker.execute(promise);
            await breaker.execute(promise);
            await breaker.execute(promise);

            expect(breaker.isClosed()).toBe(true);
        });

        test('should remain HALF_OPEN state after reset and one successful attempt', async () => {
            const promise = () => successPromise('success');

            breaker.halfOpen();
            await breaker.execute(promise);
            await breaker.execute(promise);

            breaker.halfOpen();
            await breaker.execute(promise);

            expect(breaker.isHalfOpen()).toBe(true);
        });

        test('should transition to CLOSED state after reset and reaching successThreshold', async () => {
            const promise = () => successPromise('success');

            breaker.halfOpen();
            await breaker.execute(promise);
            await breaker.execute(promise);

            breaker.halfOpen();
            await breaker.execute(promise);
            await breaker.execute(promise);

            expect(breaker.isClosed()).toBe(true);
        });
    });

    describe('retryAttempts', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 1, retryAttempts: 2 });
        });

        test('should remain in HALF_OPEN state if retries are below attempt limit', async () => {
            const promise = () => failurePromise(5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isHalfOpen()).toBe(true);
        });

        test('should transition to OPEN state upon reaching retry attempt limit', async () => {
            const promise = () => failurePromise(5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isOpen()).toBe(true);
        });

        test('should transition to OPEN state upon exceeding retry attempt limit', async () => {
            const promise = () => failurePromise(5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isOpen()).toBe(true);
        });

        test('should remain HALF_OPEN after reset and one failed retry', async () => {
            const promise = () => failurePromise(5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isHalfOpen()).toBe(true);
        });

        test('should transition to OPEN state after reset and retry limit is reached', async () => {
            const promise = () => failurePromise(5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isOpen()).toBe(true);
        });
    });

    describe('toJSON', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({});
        });

        test('should match snapshot to default options state', async () => {
            expect(breaker.toJSON()).toMatchSnapshot();
        });

    });
});
