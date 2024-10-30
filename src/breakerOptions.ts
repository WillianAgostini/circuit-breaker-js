import { Options } from "./options";

export class BreakerOptions {
    windowSize: number;
    failureThresholdPercentage: number;
    timeout?: number;
    resetTimeout?: number;
    isError?: (err: any) => boolean;
    autoRenewAbortController: boolean;

    constructor(opts: Options) {
        const {
            failureThresholdPercentage = 5,
            windowSize = 60000,
            timeout,
            resetTimeout,
            isError,
            autoRenewAbortController = false,
        } = opts;

        this.failureThresholdPercentage = failureThresholdPercentage;
        this.windowSize = windowSize;
        this.timeout = timeout;
        this.resetTimeout = resetTimeout;
        this.isError = isError;
        this.autoRenewAbortController = autoRenewAbortController;
    }
}
