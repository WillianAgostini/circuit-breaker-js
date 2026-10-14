/// <reference types="node" />

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
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

    function assertMetricsMatch(
        breaker: CircuitBreaker,
        expected: Partial<ReturnType<CircuitBreaker['metrics']>>
    ) {
        const metrics = breaker.metrics();
        assert.deepEqual(metrics, { ...metrics, ...expected });
    }

    async function openBreaker(breaker: CircuitBreaker) {
        await assert.rejects(breaker.execute(failOperation()), /failure/);
        assert.equal(breaker.metrics().isOpen, true);
    }

    async function moveToHalfOpen(breaker: CircuitBreaker, resetTimeout: number) {
        await openBreaker(breaker);
        await wait(resetTimeout + 1);
        assert.equal(breaker.metrics().isHalfOpen, true);
    }

    describe('execute', () => {
        let breaker: CircuitBreaker;

        beforeEach(() => {
            breaker = new CircuitBreaker({ timeout: 50, resetTimeout: 5 });
        });

        test('executes a successful operation and exposes its metrics', async () => {
            assert.deepEqual(await breaker.execute(delayedOperation), { message: 'success' });
            assertMetricsMatch(breaker, {
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
            await assert.rejects(breaker.execute(() => delayedOperation(110)), /This operation was aborted/);
            assert.equal(breaker.metrics().isOpen, true);
        });

        test('opens after a failure, transitions to half-open, and closes after a success', async () => {
            await moveToHalfOpen(breaker, 5);

            assert.deepEqual(await breaker.execute(delayedOperation), { message: 'success' });
            assertMetricsMatch(breaker, {
                isClosed: true,
                isOpen: false,
                isHalfOpen: false,
            });
        });

        test('rejects operations while open without invoking them', async () => {
            await openBreaker(breaker);
            let operationCalled = false;
            const operation = (...args: Parameters<typeof delayedOperation>) => {
                operationCalled = true;
                return delayedOperation(...args);
            };

            await assert.rejects(breaker.execute(operation), /Circuit is open/);
            assert.equal(operationCalled, false);
        });

        test('only admits one concurrent operation while half-open', async () => {
            await moveToHalfOpen(breaker, 5);
            let operationCalls = 0;
            const operation = () => {
                operationCalls += 1;
                return delayedOperation(10);
            };

            const results = await Promise.allSettled([
                breaker.execute(operation),
                breaker.execute(operation),
                breaker.execute(operation),
            ]);

            assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
            assert.equal(results.filter(({ status }) => status === 'rejected').length, 2);
            assert.equal(operationCalls, 1);
            assert.equal(breaker.metrics().isClosed, true);
        });

        test('rejects a Promise passed instead of a function', async () => {
            await assert.rejects(
                breaker.execute(delayedOperation() as never),
                {
                    message: 'Invalid argument: Expected a function that returns a Promise. Ensure you are passing a function, not a Promise.',
                }
            );
        });
    });

    describe('timeout defaults', () => {
        test('does not time out an operation when no timeout is configured', async () => {
            const breaker = new CircuitBreaker({});
            assert.deepEqual(await breaker.execute(() => delayedOperation(20)), { message: 'success' });
            assert.equal(breaker.metrics().isClosed, true);
        });
    });

    describe('isError', () => {
        test('does not count errors rejected by the custom predicate as failures', async () => {
            const breaker = new CircuitBreaker({
                timeout: 100,
                isError: (error) => error.message !== 'non-critical error',
            });

            await assert.rejects(
                breaker.execute(failOperation(new Error('non-critical error'))),
                /non-critical error/
            );
            assertMetricsMatch(breaker, {
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

            await assert.rejects(
                breaker.execute(failOperation(new Error('critical error'))),
                /critical error/
            );
            assert.equal(breaker.metrics().isOpen, true);
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

            assert.equal(breaker.metrics().isOpen, true);
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

            await assert.rejects(breaker.execute(failOperation()), /failure/);
            await assert.rejects(breaker.execute(failOperation()), /failure/);
            assertMetricsMatch(breaker, { isClosed: true, failureCount: 2 });

            await assert.rejects(breaker.execute(failOperation()), /failure/);
            assert.equal(breaker.metrics().isOpen, true);
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

            assert.deepEqual(await breaker.execute(delayedOperation), { message: 'success' });
            assert.equal(breaker.metrics().isHalfOpen, true);

            assert.deepEqual(await breaker.execute(delayedOperation), { message: 'success' });
            assert.equal(breaker.metrics().isClosed, true);
        });

        test('reopens after the configured number of failed attempts', async () => {
            const breaker = new CircuitBreaker({
                timeout: 100,
                resetTimeout: 5,
                retryAttempts: 2,
            });
            await moveToHalfOpen(breaker, 5);

            await assert.rejects(breaker.execute(failOperation()), /failure/);
            assert.equal(breaker.metrics().isHalfOpen, true);

            await assert.rejects(breaker.execute(failOperation()), /failure/);
            assert.equal(breaker.metrics().isOpen, true);
        });
    });

    describe('metrics', () => {
        let breaker: CircuitBreaker;
        let setMockTime: (time: number) => void;

        beforeEach((t) => {
            const timers = t.mock.timers;
            timers.enable({ apis: ['Date'] });
            timers.setTime(1_000);
            setMockTime = (time) => timers.setTime(time);
            breaker = new CircuitBreaker({
                timeout: 1_000,
                windowSize: 100,
                failureThresholdPercentage: 100,
            });
        });

        test('reports the initial metrics', () => {
            const breaker = new CircuitBreaker({});
            assert.deepEqual(breaker.metrics(), {
                isClosed: true,
                isOpen: false,
                isHalfOpen: false,
                successCount: 0,
                failureCount: 0,
                totalRequests: 0,
                failurePercentage: 0,
            });
        });

        test('tracks successful and failed requests through the public API', async () => {
            await breaker.execute(() => Promise.resolve('success'));
            await assert.rejects(breaker.execute(() => Promise.reject(new Error('failure'))), /failure/);

            assertMetricsMatch(breaker, {
                isClosed: true,
                successCount: 1,
                failureCount: 1,
                totalRequests: 2,
                failurePercentage: 50,
            });
        });

        test('keeps requests at the window boundary and expires them after it', async () => {
            await breaker.execute(() => Promise.resolve('success'));
            await assert.rejects(breaker.execute(() => Promise.reject(new Error('failure'))), /failure/);

            setMockTime(1_100);
            assertMetricsMatch(breaker, {
                successCount: 1,
                failureCount: 1,
                totalRequests: 2,
            });

            setMockTime(1_101);
            assertMetricsMatch(breaker, {
                successCount: 0,
                failureCount: 0,
                totalRequests: 0,
                failurePercentage: 0,
            });
        });

        test('expires success and failure timestamps independently', async () => {
            await breaker.execute(() => Promise.resolve('success'));
            setMockTime(1_050);
            await assert.rejects(breaker.execute(() => Promise.reject(new Error('failure'))), /failure/);

            setMockTime(1_101);
            assertMetricsMatch(breaker, {
                successCount: 0,
                failureCount: 1,
                totalRequests: 1,
                failurePercentage: 100,
            });
        });

        test('counts new requests after old timestamps expire', async () => {
            await breaker.execute(() => Promise.resolve('success'));
            setMockTime(1_101);
            assert.equal(breaker.metrics().totalRequests, 0);

            await assert.rejects(breaker.execute(() => Promise.reject(new Error('failure'))), /failure/);
            assertMetricsMatch(breaker, {
                successCount: 0,
                failureCount: 1,
                totalRequests: 1,
            });
        });
    });
});
