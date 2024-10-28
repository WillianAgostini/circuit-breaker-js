import { Options } from "./interfaces";

export enum CircuitState {
    CLOSED,
    HALF_OPEN,
    OPEN,
}

export class State {
    private current = CircuitState.CLOSED;
    private timeout: NodeJS.Timeout | undefined;

    constructor(private resetTimeout?: number) { }

    #startResetTimeout() {
        if (!this.resetTimeout) return;

        this.timeout = setTimeout(() => {
            this.setHalfOpen();
        }, this.resetTimeout)
    }

    setOpen() {
        this.current = CircuitState.OPEN;
        this.#startResetTimeout();
    }

    setClose() {
        clearTimeout(this.timeout);
        this.current = CircuitState.CLOSED;
    }

    setHalfOpen() {
        this.current = CircuitState.HALF_OPEN;
    }

    get isOpen() {
        return this.current === CircuitState.OPEN;
    }

    get isClose() {
        return this.current === CircuitState.CLOSED;
    }

    get isHalfOpen() {
        return this.current === CircuitState.HALF_OPEN;
    }

}