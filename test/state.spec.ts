import { State } from "../src";

describe('State', () => {
    let state: State;

    beforeEach(() => {
        state = new State();
    });

    test('initial state should be CLOSED', () => {
        expect(state.isOpen).toBe(false);
        expect(state.isClosed).toBe(true);
        expect(state.isHalfOpen).toBe(false);
    });

    test('state should change to OPEN', () => {
        state.setOpen();
        expect(state.isOpen).toBe(true);
        expect(state.isClosed).toBe(false);
        expect(state.isHalfOpen).toBe(false);
    });

    test('state should change to HALF_OPEN', () => {
        state.setHalfOpen();
        expect(state.isOpen).toBe(false);
        expect(state.isHalfOpen).toBe(true);
        expect(state.isClosed).toBe(false);
    });

    test('state should change to CLOSED', () => {
        state.setOpen();
        state.setClosed();
        expect(state.isOpen).toBe(false);
        expect(state.isClosed).toBe(true);
        expect(state.isHalfOpen).toBe(false);
    });
});
