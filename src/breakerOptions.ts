import { Options } from "./interfaces";

export class BreakerOptions {
    windowSize: number;
    failureThresholdPercentage: number;
    timeout?: number;
    resetTimeout?: number;
    isError?(err: any): boolean;
    autoRenewAbortController: boolean;

    constructor(opts: Options) {
        this.failureThresholdPercentage = opts.failureThresholdPercentage || 5;
        this.windowSize = opts.windowSize || 60000;
        this.timeout = opts.timeout;
        this.resetTimeout = opts.resetTimeout;
        this.isError = opts.isError;
        this.autoRenewAbortController = opts.autoRenewAbortController || false;
    }
}
