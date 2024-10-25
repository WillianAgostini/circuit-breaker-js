import { Options } from "./interfaces";

export enum CircuitState {
    CLOSED,
    HALF_OPEN,
    OPEN,
}

export class State {
    private current = CircuitState.CLOSED;

    constructor(private opts: Options) { }

    startResetTimeout() {
        if (!this.opts.resetTimeout) return;

        setTimeout(() => {
            this.setHalfOpen();
        }, this.opts.resetTimeout)
    }

    setOpen() {
        this.current = CircuitState.OPEN;
        this.startResetTimeout();
    }

    setClose() {
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