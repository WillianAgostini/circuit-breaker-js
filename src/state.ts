enum CircuitState {
    CLOSED,
    HALF_OPEN,
    OPEN,
}

export class State {
    private current = CircuitState.CLOSED;

    get isOpen() {
        return this.current === CircuitState.OPEN;
    }

    get isClose() {
        return this.current === CircuitState.CLOSED;
    }

    get isHalfOpen() {
        return this.current === CircuitState.HALF_OPEN;
    }

    setOpen() {
        this.current = CircuitState.OPEN;
    }

    setClose() {
        this.current = CircuitState.CLOSED;
    }

    setHalfOpen() {
        this.current = CircuitState.HALF_OPEN;
    }

}