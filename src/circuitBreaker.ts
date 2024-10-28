import { BreakerOptions } from "./breakerOptions";
import { Options } from "./interfaces";
import { State } from "./state";
import { WindowsSize } from "./windowsSize";

export class CircuitBreaker {
    readonly #currentState: State;
    readonly #windowsSize: WindowsSize;
    readonly #breakerOptions: BreakerOptions;

    constructor(opts: Options) {
        this.#breakerOptions = new BreakerOptions(opts);
        this.#currentState = new State(this.#breakerOptions.resetTimeout);
        this.#windowsSize = new WindowsSize(this.#breakerOptions.windowSize);
    }

    isOpen = () => this.#currentState.isOpen;
    isClose = () => this.#currentState.isClose;
    isHalfOpen = () => this.#currentState.isHalfOpen;
    open = () => {
        this.#currentState.setOpen()
        this.#windowsSize.reset();
    };
    close = () => {
        this.#currentState.setClose();
    };
    halfOpen = () => this.#currentState.setHalfOpen();

    async execute(promise: Promise<unknown>) {
        this.shouldAttemptReset();
        if (this.isOpen()) {
            throw new Error('Circuit is open');
        }

        try {
            const response = await Promise.race([promise, this.getRejectTimeout()]);
            if (this.isHalfOpen()) {
                this.close();
            }
            this.#windowsSize.pushSuccess();
            return response;
        } catch (err) {
            if (this.#breakerOptions.isError && !this.#breakerOptions.isError(err)) {
                this.#windowsSize.pushSuccess();
                throw err;
            }
            this.#windowsSize.pushFail();
            this.shouldAttemptReset();
            throw err;
        }
    }

    private getRejectTimeout() {
        if (!this.#breakerOptions.timeout) return undefined;
        return new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), this.#breakerOptions.timeout));
    }

    private shouldAttemptReset() {
        const failedPercent = this.#windowsSize.failedPercent
        const failureThresholdPercentage = this.#breakerOptions.failureThresholdPercentage;
        if (failedPercent > failureThresholdPercentage) {
            this.open();
        }
    }
}
