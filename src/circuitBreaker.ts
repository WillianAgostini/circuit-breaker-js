import { AbortManager } from "./abortManager";
import { BreakerOptions } from "./breakerOptions";
import { CircuitBreakerError } from "./circuitBreakerError";
import { CircuitBreakerEvent } from "./circuitBreakerEvent";
import { Options } from "./options";
import { State } from "./state";
import { Window } from "./window";

/**
 * Represents a function that executes an asynchronous operation with cancellation support.
 * 
 * @template T The type of the resolved value of the promise.
 */
export interface PromiseFunction<T> {
    /**
     * Executes the operation.
     * 
     * @param signal - An `AbortSignal` that allows the operation to be canceled.
     * If the operation is aborted (e.g., due to a timeout or circuit breaker),
     * the promise will reject with an `AbortError`.
     * 
     * @returns A promise that resolves with a value of type `T` or rejects 
     * if an error occurs or if the operation is aborted.
     */
    (signal: AbortSignal): Promise<T>;
}

export class CircuitBreaker {
    readonly event = new CircuitBreakerEvent();

    readonly #state: State;
    readonly #window: Window;
    readonly #options: BreakerOptions;
    readonly #abortManager = new AbortManager();
    #resetTimeout: NodeJS.Timeout | undefined;

    constructor(opts: Options) {
        this.#options = new BreakerOptions(opts);
        this.#state = new State();
        this.#window = new Window(this.#options.windowSize);
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
        // this.#abortControllers.abortAll();
        this.#state.setAttemptingClose(false);
        this.event.emit('open');
    }

    close() {
        this.#clearResetTimer();
        this.#state.setClosed();
        this.#state.setAttemptingClose(false);
        this.#window.reset();
        this.event.emit('close');
    }

    halfOpen() {
        this.#state.setHalfOpen();
        this.#state.setAttemptingClose(true);
        this.event.emit('halfOpen');
    }

    async execute<T>(promiseFunction: PromiseFunction<T>) {
        this.#ensureIsPromiseFunction(promiseFunction);
        this.#evaluateResetCondition();

        if (this.isOpen()) {
            this.event.emit('reject');
            throw new CircuitBreakerError('Circuit is open');
        }

        if (this.isHalfOpen()) {
            if (!this.#state.canTryClosing()) {
                this.event.emit('reject');
                throw new CircuitBreakerError('Circuit is halfOpen and this executions was rejected');
            }

            this.#state.setAttemptingClose(false);
        }

        const { id, abortController } = this.#abortManager.create();
        try {
            const result = await Promise.race([promiseFunction(abortController.signal), this.#timeoutRejection(abortController.signal)]);
            this.#abortManager.abort(id);
            this.#handleExecutionSuccess(result);
            return result as T;
        } catch (error) {
            this.#abortManager.abort(id);
            this.#handleExecutionError(error);
        }
    }

    #ensureIsPromiseFunction<T>(promiseFn: PromiseFunction<T>) {
        if (typeof promiseFn !== 'function') {
            throw new TypeError(`Invalid argument: Expected a function that returns a Promise. Ensure you are passing a function, not a Promise.`);
        }
    }

    #handleExecutionSuccess(result?: any) {
        if (this.isHalfOpen()) {
            this.#window.recordSuccessOnHalfOpen();
            this.#evaluateCloseCondition();
            this.#state.setAttemptingClose(true);
        }
        this.#window.recordSuccess();
        this.event.emit('success', result);
    }

    #handleExecutionError(error: any) {
        if (this.#options.isError && !this.#options.isError(error)) {
            this.#handleExecutionSuccess();
            throw error;
        }

        if (this.isHalfOpen()) {
            this.#window.recordFailureOnHalfOpen();
            this.#window.resetSuccessOnHalfOpen();
            this.#evaluateOpenCondition();
            this.#state.setAttemptingClose(true);
        }

        if (this.isClosed()) {
            this.#window.recordFailure();
            this.#evaluateResetCondition();
        }

        this.event.emit('error', error);
        throw error;
    }

    #evaluateCloseCondition() {
        if (this.#window.successCountOnHalfOpen >= this.#options.successThreshold) {
            this.close();
        }
    }

    #evaluateOpenCondition() {
        if (this.#window.failureCountOnHalfOpen >= this.#options.retryAttempts) {
            this.open();
        }
    }

    #timeoutRejection(signal: AbortSignal) {
        if (!this.#options.timeout) return;

        return new Promise((_, reject) => {
            const timeoutId = setTimeout(() => {
                clearTimeout(timeoutId);
                reject(new Error('Operation timed out'));
            }, this.#options.timeout);

            signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
            });
        });
    }

    #evaluateResetCondition() {
        if (this.#window.failurePercentage > this.#options.failureThresholdPercentage) {
            return this.open();
        }

        if (this.#options.failureThresholdCount && this.#window.failureCount >= this.#options.failureThresholdCount) {
            this.open();
        }
    }

    #startResetTimer() {
        if (!this.#options.resetTimeout) return;

        this.#resetTimeout = setTimeout(() => this.halfOpen(), this.#options.resetTimeout);
    }

    #clearResetTimer() {
        clearTimeout(this.#resetTimeout);
    }

    toJSON() {
        return {
            isOpen: this.isOpen(),
            isClosed: this.isClosed(),
            isHalfOpen: this.isHalfOpen(),
            successCount: this.successCount,
            failureCount: this.failureCount,
            totalRequests: this.totalRequests,
            failurePercentage: this.failurePercentage,
            options: this.#options,
        };
    }
}
