import { CircuitBreaker, State } from '../src/index';

describe('State', () => {
    let state: State;

    beforeEach(() => {
        state = new State({});
    });

    test('initial state should be CLOSED', () => {
        expect(state.isClose).toBe(true);
    });

    test('state should change to OPEN', () => {
        state.setOpen();
        expect(state.isOpen).toBe(true);
    });

    test('state should change to HALF_OPEN', () => {
        state.setHalfOpen();
        expect(state.isHalfOpen).toBe(true);
    });

    test('state should change to CLOSED', () => {
        state.setOpen();
        state.setClose();
        expect(state.isClose).toBe(true);
    });
});

describe('CircuitBreaker :: execute', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({ timeout: 10, resetTimeout: 5 });
    });

    test('should execute successfully', async () => {
        const promise = Promise.resolve('success');
        await expect(breaker.execute(promise)).resolves.toBe('success');
    });

    test('should throw error on timeout', async () => {
        const promise = new Promise((resolve) => setTimeout(resolve, 50));
        await expect(breaker.execute(promise)).rejects.toThrow('Operation timed out');
    });

    test('should set state to OPEN on failure', async () => {
        const promise = new Promise((_, reject) => setTimeout(() => reject(new Error('failure')), 5));
        await expect(breaker.execute(promise)).rejects.toThrow('failure');
        expect(breaker.isOpen()).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(breaker.isHalfOpen()).toBe(true);
        await breaker.execute(Promise.resolve('success'));
        expect(breaker.isClose()).toBe(true);
    });
});

describe('CircuitBreaker :: timeout', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({ timeout: 100 });
    });

    test('should execute successfully', async () => {
        const promise = Promise.resolve('success');
        await expect(breaker.execute(promise)).resolves.toBe('success');
    });

    test('should throw error on timeout', async () => {
        const promise = new Promise((resolve) => setTimeout(resolve, 200));
        await expect(breaker.execute(promise)).rejects.toThrow('Operation timed out');
    });

    test('should set state to OPEN on failure', async () => {
        const promise = new Promise((_, reject) => setTimeout(() => reject(new Error('failure')), 10));
        await expect(breaker.execute(promise)).rejects.toThrow('failure');
        expect(breaker.isOpen()).toBe(true);
    });
});

describe('CircuitBreaker :: resetTimeout', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({ timeout: 1, resetTimeout: 100 });
    });

    test('should reset state to HALF_OPEN after resetTimeout period', (done) => {
        breaker.open();
        expect(breaker.isOpen()).toBe(true);

        setTimeout(() => {
            expect(breaker.isHalfOpen()).toBe(true);
            done();
        }, 101);
    });
});