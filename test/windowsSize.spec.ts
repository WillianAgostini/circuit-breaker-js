import { WindowsSize } from "../src";

describe('WindowsSize', () => {
    let windowSize: WindowsSize;

    beforeEach(() => {
        windowSize = new WindowsSize(100);
    });

    test('should initialize with zero success and fail', () => {
        expect(windowSize.success).toBe(0);
        expect(windowSize.fail).toBe(0);
        expect(windowSize.totalRequests).toBe(0);
        expect(windowSize.failedPercent).toBe(0);
    });

    test('should track successful requests', () => {
        windowSize.pushSuccess();
        expect(windowSize.success).toBe(1);
        expect(windowSize.fail).toBe(0);
        expect(windowSize.totalRequests).toBe(1);
        expect(windowSize.failedPercent).toBe(0);
    });

    test('should track failed requests', () => {
        windowSize.pushFail();
        expect(windowSize.success).toBe(0);
        expect(windowSize.fail).toBe(1);
        expect(windowSize.totalRequests).toBe(1);
        expect(windowSize.failedPercent).toBe(100);
    });

    test('should correctly calculate success and fail over time', (done) => {
        windowSize.pushSuccess();
        windowSize.pushFail();
        expect(windowSize.success).toBe(1);
        expect(windowSize.fail).toBe(1);
        expect(windowSize.totalRequests).toBe(2);
        expect(windowSize.failedPercent).toBe(50);

        setTimeout(() => {
            windowSize.pushSuccess();
            expect(windowSize.success).toBe(1);
            expect(windowSize.fail).toBe(0);
            expect(windowSize.totalRequests).toBe(1);
            expect(windowSize.failedPercent).toBe(0);
            done();
        }, 150);
    });

    test('should reset over time', (done) => {
        windowSize.pushSuccess();
        windowSize.pushFail();
        expect(windowSize.success).toBe(1);
        expect(windowSize.fail).toBe(1);
        expect(windowSize.totalRequests).toBe(2);
        expect(windowSize.failedPercent).toBe(50);

        setTimeout(() => {
            expect(windowSize.success).toBe(0);
            expect(windowSize.fail).toBe(0);
            expect(windowSize.totalRequests).toBe(0);
            expect(windowSize.failedPercent).toBe(0);
            done();
        }, 110);
    });

    test('should reset over time without call success or fail', (done) => {
        windowSize.pushSuccess();
        windowSize.pushFail();
        expect(windowSize.totalRequests).toBe(2);
        expect(windowSize.failedPercent).toBe(50);

        setTimeout(() => {
            expect(windowSize.totalRequests).toBe(0);
            expect(windowSize.failedPercent).toBe(0);
            done();
        }, 110);
    });

    test('should reset the counters', () => {
        windowSize.pushSuccess();
        windowSize.pushFail();
        expect(windowSize.totalRequests).toBe(2);
        
        windowSize.reset();
        expect(windowSize.success).toBe(0);
        expect(windowSize.fail).toBe(0);
        expect(windowSize.totalRequests).toBe(0);
    });

    test('should calculate failedPercent correctly', () => {
        windowSize.pushSuccess();
        windowSize.pushFail();
        windowSize.pushFail();
        expect(windowSize.totalRequests).toBe(3);
        expect(windowSize.failedPercent).toBeCloseTo(66.67, 2);
    });
});
