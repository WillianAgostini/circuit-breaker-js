import { State } from "../src";
import { CircuitBreakerEvent } from "../src/circuitBreakerEvent";

describe('State', () => {
    let state: State;

    beforeEach(() => {
        state = new State(new CircuitBreakerEvent(), 100);
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

    test('shoud reset timeout after open', (done) => {
        state.setOpen();
        expect(state.isOpen).toBe(true);

        setTimeout(() => {
            expect(state.isHalfOpen).toBe(true);
            done();
        }, 101)
    });
});

describe('State', () => {
    let state: State;

    beforeEach(() => {
        state = new State(new CircuitBreakerEvent());
    });

    test('shoud not reset timeout', (done) => {
        state.setOpen();
        expect(state.isOpen).toBe(true);

        setTimeout(() => {
            expect(state.isOpen).toBe(true);
            done();
        }, 100)
    });
});
