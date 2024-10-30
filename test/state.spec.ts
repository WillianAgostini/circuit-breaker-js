import { State } from "../src";

describe('State', () => {
    let state: State;

    beforeEach(() => {
        state = new State();
    });

    test('initial state should be CLOSED', () => {
        expect(state.isClosed).toBe(true);
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
        state.setClosed();
        expect(state.isClosed).toBe(true);
    });
});
