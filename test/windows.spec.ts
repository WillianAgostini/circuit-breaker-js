import { Window } from "../src";

describe('Window', () => {
    let windowSize: Window;

    beforeEach(() => {
        windowSize = new Window(100);
    });

    test('should initialize with zero success and fail', () => {
        expect(windowSize.successCount).toBe(0);
        expect(windowSize.failureCount).toBe(0);
        expect(windowSize.totalRequests).toBe(0);
        expect(windowSize.failurePercentage).toBe(0);
    });

    test('should track successful requests', () => {
        windowSize.recordSuccess();
        expect(windowSize.successCount).toBe(1);
        expect(windowSize.failureCount).toBe(0);
        expect(windowSize.totalRequests).toBe(1);
        expect(windowSize.failurePercentage).toBe(0);
    });

    test('should track failed requests', () => {
        windowSize.recordFailure();
        expect(windowSize.successCount).toBe(0);
        expect(windowSize.failureCount).toBe(1);
        expect(windowSize.totalRequests).toBe(1);
        expect(windowSize.failurePercentage).toBe(100);
    });

    test('should correctly calculate success and fail over time', (done) => {
        windowSize.recordSuccess();
        windowSize.recordFailure();
        expect(windowSize.successCount).toBe(1);
        expect(windowSize.failureCount).toBe(1);
        expect(windowSize.totalRequests).toBe(2);
        expect(windowSize.failurePercentage).toBe(50);

        setTimeout(() => {
            windowSize.recordSuccess();
            expect(windowSize.successCount).toBe(1);
            expect(windowSize.failureCount).toBe(0);
            expect(windowSize.totalRequests).toBe(1);
            expect(windowSize.failurePercentage).toBe(0);
            done();
        }, 150);
    });

    test('should reset over time', (done) => {
        windowSize.recordSuccess();
        windowSize.recordFailure();
        expect(windowSize.successCount).toBe(1);
        expect(windowSize.failureCount).toBe(1);
        expect(windowSize.totalRequests).toBe(2);
        expect(windowSize.failurePercentage).toBe(50);

        setTimeout(() => {
            expect(windowSize.successCount).toBe(0);
            expect(windowSize.failureCount).toBe(0);
            expect(windowSize.totalRequests).toBe(0);
            expect(windowSize.failurePercentage).toBe(0);
            done();
        }, 110);
    });

    test('should reset over time without call success or fail', (done) => {
        windowSize.recordSuccess();
        windowSize.recordFailure();
        expect(windowSize.totalRequests).toBe(2);
        expect(windowSize.failurePercentage).toBe(50);

        setTimeout(() => {
            expect(windowSize.totalRequests).toBe(0);
            expect(windowSize.failurePercentage).toBe(0);
            done();
        }, 110);
    });

    test('should reset the counters', () => {
        windowSize.recordSuccess();
        windowSize.recordFailure();
        expect(windowSize.totalRequests).toBe(2);

        windowSize.reset();
        expect(windowSize.successCount).toBe(0);
        expect(windowSize.failureCount).toBe(0);
        expect(windowSize.totalRequests).toBe(0);
    });

    test('should calculate failedPercent correctly', () => {
        windowSize.recordSuccess();
        windowSize.recordFailure();
        windowSize.recordFailure();
        expect(windowSize.totalRequests).toBe(3);
        expect(windowSize.failurePercentage).toBeCloseTo(66.67, 2);
    });
});
