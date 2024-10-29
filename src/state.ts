enum CircuitState {
    CLOSED,
    PENDING_OPEN,
    HALF_OPEN,
    OPEN,
}

export class State {
    #current = CircuitState.CLOSED;
    #tryingClose = false;

    get isOpen() {
        return this.#current === CircuitState.OPEN;
    }

    get isClose() {
        return this.#current === CircuitState.CLOSED;
    }

    get isHalfOpen() {
        return this.#current === CircuitState.HALF_OPEN;
    }

    get isPendingOpen() {
        return this.#tryingClose;
    }

    setOpen() {
        this.#current = CircuitState.OPEN;
    }

    setClose() {
        this.#current = CircuitState.CLOSED;
    }

    setHalfOpen() {
        this.#current = CircuitState.HALF_OPEN;
    }

    setTryingClose(value: boolean) {
        this.#tryingClose = value;
    }

    canTryCloseCircuit() {
        return this.isPendingOpen;
    }
}