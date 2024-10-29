import { BreakerOptions } from "./breakerOptions";
import { CircuitBreakerError } from "./circuitBreakerError";
import { CircuitBreakerEvent } from "./circuitBreakerEvent";
import { Options } from "./interfaces";
import { State } from "./state";
import { WindowsSize } from "./windowsSize";

export class CircuitBreaker {
    readonly event = new CircuitBreakerEvent();

    readonly #currentState: State;
    readonly #windowsSize: WindowsSize;
    readonly #breakerOptions: BreakerOptions;
    #abortController: AbortController | undefined;
    #resetTimeoutTimer: NodeJS.Timeout | undefined;

    constructor(opts: Options) {
        this.#breakerOptions = new BreakerOptions(opts);
        this.#currentState = new State();
        this.#windowsSize = new WindowsSize(this.#breakerOptions.windowSize);
        this.#renewAbortControllerIfNedded();
    }

    getSuccess = () => this.#windowsSize.success;
    getFail = () => this.#windowsSize.fail;
    getTotalRequests = () => this.#windowsSize.totalRequests;
    getFailedPercent = () => this.#windowsSize.failedPercent;
    isOpen = () => this.#currentState.isOpen;
    isClose = () => this.#currentState.isClose;
    isHalfOpen = () => this.#currentState.isHalfOpen;

    open = () => {
        this.#currentState.setOpen();
        this.#startResetTimeout();
        this.#windowsSize.reset();
        this.#abortController?.abort();
        this.event.emit('open');
    };

    close = () => {
        this.#clearResetTimeout();
        this.#currentState.setClose();
        this.#renewAbortControllerIfNedded();
        this.event.emit('close');
    };

    halfOpen = () => {
        this.#currentState.setHalfOpen()
        this.#renewAbortControllerIfNedded();
        this.event.emit('halfOpen');
    };

    async execute(promise: Promise<unknown>) {
        this.#shouldAttemptReset();
        if (this.isOpen()) {
            this.event.emit('reject');
            throw new CircuitBreakerError('Circuit is open');
        }

        try {
            const response = await Promise.race([promise, this.#getRejectTimeout()]);
            if (this.isHalfOpen()) {
                this.close();
            }
            this.#windowsSize.pushSuccess();
            this.event.emit('sucess', response);
            return response;
        } catch (err) {
            if (err instanceof CircuitBreakerError) {
                throw err;
            }

            if (this.#breakerOptions.isError && !this.#breakerOptions.isError(err)) {
                this.#windowsSize.pushSuccess();
                this.event.emit('sucess', undefined);
                throw err;
            }

            this.#windowsSize.pushFail();
            this.#shouldAttemptReset();
            this.event.emit('error', err);
            throw err;
        }
    }

    #getRejectTimeout() {
        if (!this.#breakerOptions.timeout) return undefined;
        return new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), this.#breakerOptions.timeout));
    }

    #shouldAttemptReset() {
        const failedPercent = this.#windowsSize.failedPercent
        const failureThresholdPercentage = this.#breakerOptions.failureThresholdPercentage;
        if (failedPercent > failureThresholdPercentage) {
            this.open();
        }
    }

    #renewAbortControllerIfNedded() {
        if (!this.#breakerOptions.autoRenewAbortController) return;
        if (!this.#abortController || this.#abortController.signal.aborted)
            this.#abortController = new AbortController();
    }

    getSignal() {
        return this.#abortController?.signal;
    }

    #startResetTimeout() {
        if (!this.#breakerOptions.resetTimeout) return;

        this.#resetTimeoutTimer = setTimeout(() => {
            this.halfOpen();
        }, this.#breakerOptions.resetTimeout)
    }

    #clearResetTimeout() {
        clearTimeout(this.#resetTimeoutTimer);
    }

}
