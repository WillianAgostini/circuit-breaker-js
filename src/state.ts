import { CircuitBreakerEvent } from "./circuitBreakerEvent";

export enum CircuitState {
    CLOSED,
    HALF_OPEN,
    OPEN,
}

export class State {
    private current = CircuitState.CLOSED;
    private timeout: NodeJS.Timeout | undefined;

    constructor(private event: CircuitBreakerEvent, private resetTimeout?: number) { }

    #startResetTimeout() {
        if (!this.resetTimeout) return;

        this.timeout = setTimeout(() => {
            this.setHalfOpen();
        }, this.resetTimeout)
    }

    setOpen() {
        this.current = CircuitState.OPEN;
        this.#startResetTimeout();
        this.event.emit('open');
    }

    setClose() {
        clearTimeout(this.timeout);
        this.current = CircuitState.CLOSED;
        this.event.emit('close');
    }

    setHalfOpen() {
        this.current = CircuitState.HALF_OPEN;
        this.event.emit('halfOpen');
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