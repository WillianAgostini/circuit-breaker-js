/// <reference types="jest" />
import { CircuitBreaker } from '../src/index';

describe('CircuitBreaker', () => {
    const delayedOperation = async (delayMs = 0, error?: Error) => {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        if (error) {
            throw error;
        }
        return { message: 'success' };
    };

    const failOperation = (error = new Error('failure')) => () => Promise.reject(error);

    const wait = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

    async function openBreaker(breaker: CircuitBreaker) {
        await expect(breaker.execute(failOperation())).rejects.toThrow('failure');
        expect(breaker.metrics().isOpen).toBe(true);
    }

    async function moveToHalfOpen(breaker: CircuitBreaker, resetTimeout: number) {
        await openBreaker(breaker);
        await wait(resetTimeout + 1);
        expect(breaker.metrics().isHalfOpen).toBe(true);
    }

    describe('execute', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 50, resetTimeout: 5 });
        });

        test('executes a successful operation and exposes its metrics', async () => {
            await expect(breaker.execute(delayedOperation)).resolves.toEqual({ message: 'success' });
            expect(breaker.metrics()).toMatchObject({
                isClosed: true,
                isOpen: false,
                isHalfOpen: false,
                successCount: 1,
                failureCount: 0,
                totalRequests: 1,
                failurePercentage: 0,
            });
        });

        test('rejects an operation that exceeds the timeout', async () => {
            await expect(breaker.execute(() => delayedOperation(110))).rejects.toThrow('This operation was aborted');
            expect(breaker.metrics().isOpen).toBe(true);
        });

        test('opens after a failure, transitions to half-open, and closes after a success', async () => {
            await moveToHalfOpen(breaker, 5);

            await expect(breaker.execute(delayedOperation)).resolves.toEqual({ message: 'success' });
            expect(breaker.metrics()).toMatchObject({
                isClosed: true,
                isOpen: false,
                isHalfOpen: false,
            });
        });

        test('rejects operations while open without invoking them', async () => {
            await openBreaker(breaker);
            const operation = jest.fn(delayedOperation);

            await expect(breaker.execute(operation)).rejects.toThrow('Circuit is open');
            expect(operation).not.toHaveBeenCalled();
        });

        test('only admits one concurrent operation while half-open', async () => {
            await moveToHalfOpen(breaker, 5);
            const operation = jest.fn(() => delayedOperation(10));

            const results = await Promise.allSettled([
                breaker.execute(operation),
                breaker.execute(operation),
                breaker.execute(operation),
            ]);

            expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
            expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(2);
            expect(operation).toHaveBeenCalledTimes(1);
            expect(breaker.metrics().isClosed).toBe(true);
        });

        test('rejects a Promise passed instead of a function', async () => {
            await expect(breaker.execute(delayedOperation() as never)).rejects.toThrow(
                'Invalid argument: Expected a function that returns a Promise. Ensure you are passing a function, not a Promise.'
            );
        });
    });

    describe('timeout defaults', () => {
        test('does not time out an operation when no timeout is configured', async () => {
            const breaker = new CircuitBreaker({});
            jest.useFakeTimers();
            try {
                const execution = breaker.execute(() => delayedOperation(20));
                await jest.advanceTimersByTimeAsync(20);
                await expect(execution).resolves.toEqual({ message: 'success' });
                expect(breaker.metrics().isClosed).toBe(true);
            } finally {
                jest.clearAllTimers();
                jest.useRealTimers();
            }
        });
    });

    describe('isError', () => {
        test('does not count errors rejected by the custom predicate as failures', async () => {
            const breaker = new CircuitBreaker({
                timeout: 100,
                isError: (error) => error.message !== 'non-critical error',
            });

            await expect(
                breaker.execute(failOperation(new Error('non-critical error')))
            ).rejects.toThrow('non-critical error');
            expect(breaker.metrics()).toMatchObject({
                isClosed: true,
                successCount: 1,
                failureCount: 0,
            });
        });

        test('counts critical errors as failures', async () => {
            const breaker = new CircuitBreaker({
                timeout: 100,
                isError: (error) => error.message !== 'non-critical error',
            });

            await expect(
                breaker.execute(failOperation(new Error('critical error')))
            ).rejects.toThrow('critical error');
            expect(breaker.metrics().isOpen).toBe(true);
        });
    });

    describe('resetTimeout', () => {
        test('transitions from open to half-open after the configured delay', async () => {
            const breaker = new CircuitBreaker({ timeout: 100, resetTimeout: 10 });
            await moveToHalfOpen(breaker, 10);
        });

        test('uses the default reset delay when none is configured', async () => {
            const breaker = new CircuitBreaker({ timeout: 100 });
            await openBreaker(breaker);
            await wait(20);

            expect(breaker.metrics().isOpen).toBe(true);
        });
    });

    describe('failureThresholdCount', () => {
        test('opens when the configured number of failures is reached', async () => {
            const breaker = new CircuitBreaker({
                timeout: 100,
                resetTimeout: 100,
                failureThresholdCount: 3,
                failureThresholdPercentage: 100,
            });

            await expect(breaker.execute(failOperation())).rejects.toThrow('failure');
            await expect(breaker.execute(failOperation())).rejects.toThrow('failure');
            expect(breaker.metrics()).toMatchObject({ isClosed: true, failureCount: 2 });

            await expect(breaker.execute(failOperation())).rejects.toThrow('failure');
            expect(breaker.metrics().isOpen).toBe(true);
        });
    });

    describe('half-open thresholds', () => {
        test('requires the configured number of successful attempts before closing', async () => {
            const breaker = new CircuitBreaker({
                timeout: 100,
                resetTimeout: 5,
                successThreshold: 2,
            });
            await moveToHalfOpen(breaker, 5);

            await expect(breaker.execute(delayedOperation)).resolves.toEqual({ message: 'success' });
            expect(breaker.metrics().isHalfOpen).toBe(true);

            await expect(breaker.execute(delayedOperation)).resolves.toEqual({ message: 'success' });
            expect(breaker.metrics().isClosed).toBe(true);
        });

        test('reopens after the configured number of failed attempts', async () => {
            const breaker = new CircuitBreaker({
                timeout: 100,
                resetTimeout: 5,
                retryAttempts: 2,
            });
            await moveToHalfOpen(breaker, 5);

            await expect(breaker.execute(failOperation())).rejects.toThrow('failure');
            expect(breaker.metrics().isHalfOpen).toBe(true);

            await expect(breaker.execute(failOperation())).rejects.toThrow('failure');
            expect(breaker.metrics().isOpen).toBe(true);
        });
    });

    describe('metrics', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date(1_000));
            breaker = new CircuitBreaker({
                timeout: 1_000,
                windowSize: 100,
                failureThresholdPercentage: 100,
            });
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('reports the initial metrics', () => {
            const breaker = new CircuitBreaker({});
            expect(breaker.metrics()).toMatchSnapshot();
        });

        test('tracks successful and failed requests through the public API', async () => {
            await breaker.execute(() => Promise.resolve('success'));
            await expect(breaker.execute(() => Promise.reject(new Error('failure')))).rejects.toThrow('failure');

            expect(breaker.metrics()).toMatchObject({
                isClosed: true,
                successCount: 1,
                failureCount: 1,
                totalRequests: 2,
                failurePercentage: 50,
            });
        });

        test('keeps requests at the window boundary and expires them after it', async () => {
            await breaker.execute(() => Promise.resolve('success'));
            await expect(breaker.execute(() => Promise.reject(new Error('failure')))).rejects.toThrow('failure');

            jest.setSystemTime(new Date(1_100));
            expect(breaker.metrics()).toMatchObject({
                successCount: 1,
                failureCount: 1,
                totalRequests: 2,
            });

            jest.setSystemTime(new Date(1_101));
            expect(breaker.metrics()).toMatchObject({
                successCount: 0,
                failureCount: 0,
                totalRequests: 0,
                failurePercentage: 0,
            });
        });

        test('expires success and failure timestamps independently', async () => {
            await breaker.execute(() => Promise.resolve('success'));
            jest.setSystemTime(new Date(1_050));
            await expect(breaker.execute(() => Promise.reject(new Error('failure')))).rejects.toThrow('failure');

            jest.setSystemTime(new Date(1_101));
            expect(breaker.metrics()).toMatchObject({
                successCount: 0,
                failureCount: 1,
                totalRequests: 1,
                failurePercentage: 100,
            });
        });

        test('counts new requests after old timestamps expire', async () => {
            await breaker.execute(() => Promise.resolve('success'));
            jest.setSystemTime(new Date(1_101));
            expect(breaker.metrics().totalRequests).toBe(0);

            await expect(breaker.execute(() => Promise.reject(new Error('failure')))).rejects.toThrow('failure');
            expect(breaker.metrics()).toMatchObject({
                successCount: 0,
                failureCount: 1,
                totalRequests: 1,
            });
        });
    });
});
