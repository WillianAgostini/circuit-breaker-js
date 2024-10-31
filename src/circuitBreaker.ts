import { BreakerOptions } from "./breakerOptions";
import { CircuitBreakerError } from "./circuitBreakerError";
import { CircuitBreakerEvent } from "./circuitBreakerEvent";
import { Options } from "./options";
import { State } from "./state";
import { Window } from "./window";

export class CircuitBreaker {
    readonly event = new CircuitBreakerEvent();

    readonly #state: State;
    readonly #window: Window;
    readonly #options: BreakerOptions;
    #abortController: AbortController | undefined;
    #resetTimeout: NodeJS.Timeout | undefined;

    constructor(opts: Options) {
        this.#options = new BreakerOptions(opts);
        this.#state = new State();
        this.#window = new Window(this.#options.windowSize);
        this.#initializeAbortController();
    }

    get successCount() {
        return this.#window.successCount;
    }

    get failureCount() {
        return this.#window.failureCount;
    }

    get totalRequests() {
        return this.#window.totalRequests;
    }

    get failurePercentage() {
        return this.#window.failurePercentage;
    }

    get signal() {
        return this.#abortController?.signal;
    }

    isOpen() {
        return this.#state.isOpen;
    }

    isClosed() {
        return this.#state.isClosed;
    }

    isHalfOpen() {
        return this.#state.isHalfOpen;
    }

    open() {
        this.#state.setOpen();
        this.#startResetTimer();
        this.#window.reset();
        this.#abortController?.abort();
        this.#state.setAttemptingClose(false);
        this.event.emit('open');
    }

    close() {
        this.#clearResetTimer();
        this.#state.setClosed();
        this.#initializeAbortController();
        this.#state.setAttemptingClose(false);
        this.#window.reset();
        this.event.emit('close');
    }

    halfOpen() {
        this.#state.setHalfOpen();
        this.#initializeAbortController();
        this.#state.setAttemptingClose(true);
        this.event.emit('halfOpen');
    }

    async execute(promise: Promise<unknown>) {
        this.#evaluateResetCondition();

        if (this.isOpen()) {
            this.event.emit('reject');
            throw new CircuitBreakerError('Circuit is open');
        }

        if (this.isHalfOpen()) {
            if (!this.#state.canTryClosing()) {
                this.event.emit('reject');
                throw new CircuitBreakerError('Circuit is open');
            }

            this.#state.setAttemptingClose(false);
        }

        try {
            const result = await Promise.race([promise, this.#timeoutRejection()]);
            if (this.isHalfOpen()) {
                this.#window.recordSuccessOnHalfOpen();
                if (!this.#evaluateCloseCondition()) {
                    this.#state.setAttemptingClose(true);
                }
            }
            this.#window.recordSuccess();
            this.event.emit('success', result);
            return result;
        } catch (error) {
            this.#handleExecutionError(error);
        }
    }

    #evaluateCloseCondition() {
        if (this.#window.successCountOnHalfOpen >= this.#options.successThreshold) {
            this.close();
            return true;
        }
        return false;
    }

    #timeoutRejection() {
        if (!this.#options.timeout) return undefined;
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), this.#options.timeout)
        );
    }

    #evaluateResetCondition() {
        if (this.#window.failurePercentage > this.#options.failureThresholdPercentage) {
            this.open();
        }

        if (this.#options.failureThresholdCount && this.#window.failureCount >= this.#options.failureThresholdCount) {
            this.open();
        }
    }

    #initializeAbortController() {
        if (!this.#options.autoRenewAbortController) return;
        if (!this.#abortController || this.#abortController.signal.aborted) {
            this.#abortController = new AbortController();
        }
    }

    #startResetTimer() {
        if (!this.#options.resetTimeout) return;

        this.#resetTimeout = setTimeout(() => this.halfOpen(), this.#options.resetTimeout);
    }

    #clearResetTimer() {
        clearTimeout(this.#resetTimeout);
    }

    #handleExecutionError(error: unknown) {
        if (this.#options.isError && !this.#options.isError(error)) {
            this.#window.recordSuccess();
            this.event.emit('success', undefined);
            throw error;
        }

        if (this.isHalfOpen()) {
            this.#window.resetSuccessOnHalfOpen();
        }

        this.#window.recordFailure();
        this.#evaluateResetCondition();
        this.event.emit('error', error);
        throw error;
    }
}
