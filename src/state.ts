enum CircuitState {
    CLOSED,
    HALF_OPEN,
    OPEN,
}

export class State {
    #currentState = CircuitState.CLOSED;
    #attemptingClose = false;

    get isOpen() {
        return this.#currentState === CircuitState.OPEN;
    }

    get isClosed() {
        return this.#currentState === CircuitState.CLOSED;
    }

    get isHalfOpen() {
        return this.#currentState === CircuitState.HALF_OPEN;
    }

    setOpen() {
        this.#currentState = CircuitState.OPEN;
    }

    setClosed() {
        this.#currentState = CircuitState.CLOSED;
    }

    setHalfOpen() {
        this.#currentState = CircuitState.HALF_OPEN;
    }

    setAttemptingClose(value: boolean) {
        this.#attemptingClose = value;
    }

    canTryClosing() {
        return this.#attemptingClose;
    }
}
