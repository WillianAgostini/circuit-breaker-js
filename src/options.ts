export interface Options {
    /** 
     * Time window in milliseconds to track failures and successes.
     * Used to calculate failure rates within the given timeframe.
     */
    windowSize?: number;

    /** 
     * Percentage threshold of failures within the windowSize that triggers the circuit to open.
     */
    failureThresholdPercentage?: number;

    /** 
     * Maximum time in milliseconds allowed for a request before it is considered a failure.
     */
    timeout?: number;

    /** 
     * Time in milliseconds the circuit remains open before attempting to transition to half-open.
     */
    resetTimeout?: number;

    /** 
     * Custom error-checking function to determine if an error should count as a failure.
     */
    isError?: (err: any) => boolean;

    /** 
     * Whether to automatically renew the AbortController for each new request when the circuit is closed.
     */
    autoRenewAbortController?: boolean;

    /** 
     * Alternative to failureThresholdPercentage; opens the circuit when failures reach this count within the window.
     */
    failureThresholdCount?: number;

    /** 
     * Number of allowed retry attempts in the half-open state before opening the circuit again if failures persist.
     */
    retryAttempts?: number;

    /** 
     * Number of consecutive successes required in the half-open state to fully close the circuit.
     */
    successThreshold?: number;
}
