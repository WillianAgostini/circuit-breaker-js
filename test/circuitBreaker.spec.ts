import { CircuitBreaker } from '../src/index';
import http from 'http';

describe('CircuitBreaker', () => {

    let breaker: CircuitBreaker;
    let server: http.Server;
    let serverUrl: string;
    const abortedMessage = 'This operation was aborted';

    const fetchWithSignal = async (signal: AbortSignal | undefined = undefined, timeoutMs = 0, error?: Error) => {
        const headers = new Headers({
            'timeout-ms': timeoutMs.toString(),
        });
        const response = await fetch(serverUrl, { signal, headers });
        if (error)
            throw error;

        return response.json();
    };

    beforeAll((done) => {
        server = http.createServer((req, res) => {
            const ms = req.headers['timeout-ms'];
            const timeout = ms != undefined ? Number(ms) : 1;
            setTimeout(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'success' }));
            }, timeout);
        });

        server.listen(() => {
            const address = server.address();
            if (typeof address === 'object' && address !== null) {
                serverUrl = `http://localhost:${address.port}`;
            }
            done();
        });
    });

    afterAll((done) => {
        server.close(done);
    });

    describe('execute', () => {

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 50, resetTimeout: 5 });
        });

        test('should cancel promises when circuit has opened', async () => {
            setTimeout(() => breaker.open(), 50);
            await expect(breaker.execute((signal) => fetchWithSignal(signal, 99))).rejects.toThrow(abortedMessage);
        });

        test('should abort fetch request when circuit breaker timeout is reached', async () => {
            await expect(breaker.execute((s) => fetchWithSignal(s, 100))).rejects.toThrow(abortedMessage);
        });

        test('should fetch successfully before timeout', async () => {
            breaker = new CircuitBreaker({ timeout: 200, resetTimeout: 5 });

            const fetchWithSignal = async (signal: AbortSignal) => {
                const response = await fetch(serverUrl, { signal });
                return response.json();
            };

            await expect(breaker.execute(fetchWithSignal)).resolves.toEqual({ message: 'success' });
        });

        test('should execute successfully', async () => {
            await expect(breaker.execute(fetchWithSignal)).resolves.toEqual({ message: 'success' });
        });

        test('should throw error on timeout', async () => {
            await expect(breaker.execute((signal) => fetchWithSignal(signal, 110))).rejects.toThrow(abortedMessage);
        });

        test('should set state to OPEN on failure', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(breaker.isOpen()).toBe(true);
            await fetchWithSignal(undefined, 5);
            expect(breaker.isHalfOpen()).toBe(true);
            await breaker.execute(fetchWithSignal);
            expect(breaker.isClosed()).toBe(true);
        });

        test('should throw error when circuit is OPEN', async () => {
            breaker.open();
            await expect(breaker.execute(fetchWithSignal)).rejects.toThrow('Circuit is open');
        });

        test('should not sum error when circuit is OPEN', async () => {
            breaker.open();
            await expect(breaker.execute(fetchWithSignal)).rejects.toThrow('Circuit is open');
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

            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 1);

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

            const failPromise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5);

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

            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5);

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
            const promise = fetchWithSignal() as any;
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
            const promise = () => fetchWithSignal();
            await expect(breaker.execute(promise)).resolves.toEqual({ message: 'success' });
        });

        test('should set state to OPEN on failure', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 10, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(breaker.isOpen()).toBe(true);
        });
    });

    describe('resetTimeout', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 50 });
        });

        test('should reset timeout after open', (done) => {
            breaker.open();
            expect(breaker.isOpen()).toBe(true);

            setTimeout(() => {
                expect(breaker.isHalfOpen()).toBe(true);
                done();
            }, 51);
        });

        test('should not reset timeout when resetTimeout is undefined', (done) => {
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
            breaker = new CircuitBreaker({ timeout: 50, resetTimeout: 5 });
        });

        test('should transition from HALF_OPEN to CLOSE on successful request', async () => {
            breaker.halfOpen();
            expect(breaker.isHalfOpen()).toBe(true);
            await expect(breaker.execute(fetchWithSignal)).resolves.toEqual({ message: 'success' });
            expect(breaker.isClosed()).toBe(true);
        });

        test('should transition from HALF_OPEN to OPEN on failed request', async () => {
            breaker.halfOpen();
            expect(breaker.isHalfOpen()).toBe(true);
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(breaker.isOpen()).toBe(true);
        });

        test('should reset state to HALF_OPEN after resetTimeout', async () => {
            breaker.open();
            await fetchWithSignal(undefined, 10);
            expect(breaker.isHalfOpen()).toBe(true);
        });
    });

    describe('state transitions with default options', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({});
        });

        test('should not throw timeout exception when timeout is undefined', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 50);
            await expect(breaker.execute(promise)).resolves.toEqual({ message: 'success' });
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
            const promise = () => fetchWithSignal();
            await expect(breaker.execute(promise)).resolves.toEqual({ message: 'success' });
        });

        test('should not consider non-critical error as a failure', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('non-critical error'));
            await expect(breaker.execute(promise)).rejects.toThrow('non-critical error');
            expect(breaker.isOpen()).toBe(false);
        });

        test('should consider critical error as a failure', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('critical error'));
            await expect(breaker.execute(promise)).rejects.toThrow('critical error');
            expect(breaker.isOpen()).toBe(true);
        });

        test('should throw error when circuit is open', async () => {
            breaker.open();
            const promise = () => fetchWithSignal();
            await expect(breaker.execute(promise)).rejects.toThrow('Circuit is open');
        });

        test('should re-throw error and open circuit for critical error', async () => {
            const errorEventMock = jest.fn();
            breaker.event.on('error', errorEventMock);

            const criticalError = new Error('critical error');
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, criticalError);

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
            breaker = new CircuitBreaker({ timeout: 100, resetTimeout: 5 });
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
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(openListener).toHaveBeenCalled();
        });

        test('should emit close event', async () => {
            breaker.halfOpen();
            const promise = () => fetchWithSignal();
            await expect(breaker.execute(promise)).resolves.toEqual({ message: 'success' });
            expect(closeListener).toHaveBeenCalled();
        });

        test('should emit halfOpen event', async () => {
            breaker.open();
            await fetchWithSignal(undefined, 11);
            expect(halfOpenListener).toHaveBeenCalled();
        });

        test('should emit success event', async () => {
            await expect(breaker.execute(fetchWithSignal)).resolves.toEqual({ message: 'success' });
            expect(successListener).toHaveBeenCalledWith({ message: 'success' });
        });

        test('should emit error event', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));
            await expect(breaker.execute(promise)).rejects.toThrow('failure');
            expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('failureThresholdCount', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({
                timeout: 100,
                resetTimeout: 100,
                failureThresholdCount: 3,
                failureThresholdPercentage: 100,
            });
        });

        test('should remain closed when failures are below the threshold', async () => {
            const promise = () => fetchWithSignal();
            const failPromise = () => Promise.reject('failure');

            await Promise.all(Array.from({ length: 10 }).map(() => breaker.execute(promise)));
            await Promise.allSettled([
                breaker.execute(failPromise),
                breaker.execute(failPromise),
            ]);

            expect(breaker.isClosed()).toBe(true);
        });

        test('should open circuit when failure count reaches the threshold', async () => {
            const promise = () => fetchWithSignal();
            const failPromise = () => Promise.reject('failure');

            await Promise.all(Array.from({ length: 10 }).map(() => breaker.execute(promise)));
            await Promise.allSettled([
                breaker.execute(failPromise),
                breaker.execute(failPromise),
                breaker.execute(failPromise),
            ]);

            expect(breaker.isOpen()).toBe(true);
        });

        test('should set state to OPEN passing max failureThresholdCount', async () => {
            const promise = () => fetchWithSignal();
            const failPromise = () => Promise.reject('failure');

            await Promise.all(Array.from({ length: 10 }).map(() => breaker.execute(promise)));
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
            breaker = new CircuitBreaker({ timeout: 100, resetTimeout: 100, successThreshold: 2 });
        });

        test('should remain in HALF_OPEN state when successThreshold is below limit', async () => {
            const promise = () => fetchWithSignal();
            breaker.halfOpen();

            await breaker.execute(promise);

            expect(breaker.isHalfOpen()).toBe(true);
        });

        test('should transition to CLOSED state when reaching successThreshold limit', async () => {
            const promise = () => fetchWithSignal();
            breaker.halfOpen();

            await breaker.execute(promise);
            await breaker.execute(promise);

            expect(breaker.isClosed()).toBe(true);
        });

        test('should transition to CLOSED state when exceeding successThreshold limit', async () => {
            const promise = () => fetchWithSignal();
            breaker.halfOpen();

            await breaker.execute(promise);
            await breaker.execute(promise);
            await breaker.execute(promise);

            expect(breaker.isClosed()).toBe(true);
        });

        test('should remain HALF_OPEN state after reset and one successful attempt', async () => {
            const promise = () => fetchWithSignal();

            breaker.halfOpen();
            await breaker.execute(promise);
            await breaker.execute(promise);

            breaker.halfOpen();
            await breaker.execute(promise);

            expect(breaker.isHalfOpen()).toBe(true);
        });

        test('should transition to CLOSED state after reset and reaching successThreshold', async () => {
            const promise = () => fetchWithSignal();

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
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isHalfOpen()).toBe(true);
        });

        test('should transition to OPEN state upon reaching retry attempt limit', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isOpen()).toBe(true);
        });

        test('should transition to OPEN state upon exceeding retry attempt limit', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isOpen()).toBe(true);
        });

        test('should remain HALF_OPEN after reset and one failed retry', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);
            await Promise.allSettled([breaker.execute(promise)]);

            breaker.halfOpen();
            await Promise.allSettled([breaker.execute(promise)]);

            expect(breaker.isHalfOpen()).toBe(true);
        });

        test('should transition to OPEN state after reset and retry limit is reached', async () => {
            const promise = (signal: AbortSignal) => fetchWithSignal(signal, 5, new Error('failure'));

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
