export interface Options {
    /** 
     * Time window in milliseconds to track failures and successes.
     * Used to calculate failure rates within the given timeframe.
     * @default 60000
     */
    windowSize?: number;

    /** 
     * Percentage threshold of failures within the windowSize that triggers the circuit to open.
     * @default 5
     */
    failureThresholdPercentage?: number;

    /** 
     * Maximum time in milliseconds allowed for a request before it is considered a failure.
     * @default undefined
     */
    timeout?: number;

    /** 
     * Time in milliseconds the circuit remains open before attempting to transition to half-open.
     * @default undefined
     */
    resetTimeout?: number;

    /** 
     * Custom error-checking function to determine if an error should count as a failure.
     * @default undefined
     */
    isError?: (err: any) => boolean;

    /** 
     * Alternative to failureThresholdPercentage; opens the circuit when failures reach this count within the window.
     * @default 0
     */
    failureThresholdCount?: number;

    /** 
     * Number of allowed retry attempts in the half-open state before opening the circuit again if failures persist.
     * @default 1
     */
    retryAttempts?: number;

    /** 
     * Number of consecutive successes required in the half-open state to fully close the circuit.
     * @default 1
     */
    successThreshold?: number;
}