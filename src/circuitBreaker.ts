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
     * @returns A promise that resolves with a value of type `T` or rejects 
     * if an error occurs or if the operation is aborted.
     */
    (): Promise<T>;
}

export interface Metrics {
    isOpen: boolean;
    isClosed: boolean;
    isHalfOpen: boolean;
    successCount: number;
    failureCount: number;
    totalRequests: number;
    failurePercentage: number;
}

export class CircuitBreaker {
    readonly #state: State;
    readonly #window: Window;
    readonly #options: BreakerOptions;
    #resetTimeout: NodeJS.Timeout | undefined;

    constructor(opts: Options) {
        this.#options = new BreakerOptions(opts);
        this.#window = new Window(this.#options.windowSize);
        this.#state = new State();
    }

    #isOpen() {
        return this.#state.isOpen;
    }

    #isClosed() {
        return this.#state.isClosed;
    }

    #isHalfOpen() {
        return this.#state.isHalfOpen;
    }

    #open() {
        this.#state.setOpen();
        this.#startResetTimer();
        this.#window.reset();
        this.#state.setAttemptingClose(false);
    }

    #close() {
        this.#clearResetTimer();
        this.#state.setClosed();
        this.#state.setAttemptingClose(false);
    }

    #halfOpen() {
        this.#clearResetTimer();
        this.#state.setHalfOpen();
        this.#state.setAttemptingClose(true);
    }

    async execute<T>(promiseFunction: PromiseFunction<T>) {
        this.#ensureIsPromiseFunction(promiseFunction);
        this.#evaluateResetCondition();

        if (this.#isOpen()) {
            throw new CircuitBreakerError('Circuit is open');
        }

        if (this.#isHalfOpen()) {
            if (!this.#state.canTryClosing()) {
                throw new CircuitBreakerError('Circuit is halfOpen and this executions was rejected');
            }

            this.#state.setAttemptingClose(false);
        }

        try {
            const tasks: Promise<any>[] = [promiseFunction(), this.#timeoutRejection()];
            const result = await Promise.race(tasks);
            this.#handleExecutionSuccess();
            return result as T;
        } catch (error) {
            this.#handleExecutionError(error);
        }
    }

    #ensureIsPromiseFunction<T>(promiseFn: PromiseFunction<T>) {
        if (typeof promiseFn !== 'function') {
            throw new TypeError(`Invalid argument: Expected a function that returns a Promise. Ensure you are passing a function, not a Promise.`);
        }
    }

    #handleExecutionSuccess() {
        if (this.#isHalfOpen()) {
            this.#window.recordSuccessOnHalfOpen();
            this.#evaluateCloseCondition();
            this.#state.setAttemptingClose(true);
        }
        this.#window.recordSuccess();
    }

    #handleExecutionError(error: any) {
        if (this.#options.isError && !this.#options.isError(error)) {
            this.#handleExecutionSuccess();
            throw error;
        }

        if (this.#isHalfOpen()) {
            this.#window.recordFailureOnHalfOpen();
            this.#window.resetSuccessOnHalfOpen();
            this.#evaluateOpenCondition();
            this.#state.setAttemptingClose(true);
        }

        if (this.#isClosed()) {
            this.#window.recordFailure();
            this.#evaluateResetCondition();
        }

        throw error;
    }

    #evaluateCloseCondition() {
        if (this.#window.successCountOnHalfOpen >= this.#options.successThreshold) {
            this.#close();
        }
    }

    #evaluateOpenCondition() {
        if (this.#window.failureCountOnHalfOpen >= this.#options.retryAttempts) {
            this.#open();
        }
    }

    #timeoutRejection() {
        return new Promise((_, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('This operation was aborted'));
                clearTimeout(timeoutId);
            }, this.#options.timeout);
        });
    }

    #evaluateResetCondition() {
        if (this.#window.failurePercentage > this.#options.failureThresholdPercentage) {
            return this.#open();
        }

        if (this.#options.failureThresholdCount && this.#window.failureCount >= this.#options.failureThresholdCount) {
            this.#open();
        }
    }

    #startResetTimer() {
        this.#resetTimeout = setTimeout(() => this.#halfOpen(), this.#options.resetTimeout);
    }

    #clearResetTimer() {
        clearTimeout(this.#resetTimeout);
    }

    metrics(): Metrics {
        return {
            isOpen: this.#isOpen(),
            isClosed: this.#isClosed(),
            isHalfOpen: this.#isHalfOpen(),
            successCount: this.#window.successCount,
            failureCount: this.#window.failureCount,
            totalRequests: this.#window.totalRequests,
            failurePercentage: this.#window.failurePercentage,
        };
    }
}
