import { CircuitBreaker } from '../src/index';

const successPromise = (value: string) => Promise.resolve(value);
const failurePromise = (timeout: number, error: Error) => new Promise((_, reject) => setTimeout(() => reject(error), timeout));
const timeoutPromise = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout));

describe('CircuitBreaker :: execute', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 5 });
    });

    test('should execute successfully', async () => {
        const promise = successPromise('success');
        await expect(breaker.execute(promise)).resolves.toBe('success');
    });

    test('should throw error on timeout', async () => {
        const promise = timeoutPromise(50);
        await expect(breaker.execute(promise)).rejects.toThrow('Operation timed out');
    });

    test('should set state to OPEN on failure', async () => {
        const promise = failurePromise(5, new Error('failure'));
        await expect(breaker.execute(promise)).rejects.toThrow('failure');
        expect(breaker.isOpen()).toBe(true);
        await timeoutPromise(5);
        expect(breaker.isHalfOpen()).toBe(true);
        await breaker.execute(successPromise('success'));
        expect(breaker.isClose()).toBe(true);
    });

    test('should throw error when circuit is open', async () => {
        breaker.open();
        const promise = successPromise('success');
        await expect(breaker.execute(promise)).rejects.toThrow('Circuit is open');
    });
});

describe('CircuitBreaker :: timeout', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({ timeout: 100 });
    });

    test('should execute successfully', async () => {
        const promise = successPromise('success');
        await expect(breaker.execute(promise)).resolves.toBe('success');
    });

    test('should throw error on timeout', async () => {
        const promise = timeoutPromise(200);
        await expect(breaker.execute(promise)).rejects.toThrow('Operation timed out');
    });

    test('should set state to OPEN on failure', async () => {
        const promise = failurePromise(10, new Error('failure'));
        await expect(breaker.execute(promise)).rejects.toThrow('failure');
        expect(breaker.isOpen()).toBe(true);
    });

});

describe('CircuitBreaker :: state transitions', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 5 });
    });

    test('should transition from HALF_OPEN to CLOSE on successful request', async () => {
        breaker.halfOpen();
        expect(breaker.isHalfOpen()).toBe(true);
        const promise = successPromise('success');
        await expect(breaker.execute(promise)).resolves.toBe('success');
        expect(breaker.isClose()).toBe(true);
    });

    test('should transition from HALF_OPEN to OPEN on failed request', async () => {
        breaker.halfOpen();
        expect(breaker.isHalfOpen()).toBe(true);
        const promise = failurePromise(5, new Error('failure'));
        await expect(breaker.execute(promise)).rejects.toThrow('failure');
        expect(breaker.isOpen()).toBe(true);
    });

    test('should reset state to HALF_OPEN after resetTimeout', async () => {
        breaker.open();
        await timeoutPromise(10);
        expect(breaker.isHalfOpen()).toBe(true);
    });
});

describe('CircuitBreaker :: state transitions', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({});
    });

    test('should not throw timeout exeption when timeout is undefined', async () => {
        const promise = timeoutPromise(50);
        await breaker.execute(promise);
        expect(breaker.isClose()).toBe(true);
    });
});

describe('CircuitBreaker :: isError', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({
            timeout: 10,
            resetTimeout: 5,
            isError: (err) => err.message !== 'non-critical error',
        });
    });

    test('should execute successfully', async () => {
        const promise = successPromise('success');
        await expect(breaker.execute(promise)).resolves.toBe('success');
    });

    test('should not consider non-critical error as a failure', async () => {
        const promise = failurePromise(5, new Error('non-critical error'));
        await expect(breaker.execute(promise)).rejects.toThrow('non-critical error');
        expect(breaker.isOpen()).toBe(false);
    });

    test('should consider critical error as a failure', async () => {
        const promise = failurePromise(5, new Error('critical error'));
        await expect(breaker.execute(promise)).rejects.toThrow('critical error');
        expect(breaker.isOpen()).toBe(true);
    });

    test('should throw error when circuit is open', async () => {
        breaker.open();
        const promise = successPromise('success');
        await expect(breaker.execute(promise)).rejects.toThrow('Circuit is open');
    });
});
