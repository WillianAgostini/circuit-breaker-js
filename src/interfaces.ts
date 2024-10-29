export interface Options {
    windowSize?: number;
    failureThresholdPercentage?: number;
    timeout?: number,
    resetTimeout?: number,
    isError?(err: any): boolean;
    autoRenewAbortController?: boolean;
}
