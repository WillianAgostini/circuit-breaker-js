export class Window {
    #successTimestamps: number[] = [];
    #successTimestampsOnHalfOpen: number[] = [];
    #failureTimestamps: number[] = [];

    constructor(private readonly windowSizeMs: number) {}

    get successCount(): number {
        this.#successTimestamps = this.#filterWithinWindow(this.#successTimestamps);
        return this.#successTimestamps.length;
    }

    get successCountOnHalfOpen(): number {
        return this.#successTimestampsOnHalfOpen.length;
    }

    get failureCount(): number {
        this.#failureTimestamps = this.#filterWithinWindow(this.#failureTimestamps);
        return this.#failureTimestamps.length;
    }

    get totalRequests(): number {
        return this.successCount + this.failureCount;
    }

    get failurePercentage(): number {
        const total = this.totalRequests;
        return total > 0 ? (this.failureCount * 100) / total : 0;
    }

    recordSuccess(): void {
        this.#successTimestamps.push(Date.now());
    }

    recordSuccessOnHalfOpen(): void {
        this.#successTimestampsOnHalfOpen.push(Date.now());
    }

    recordFailure(): void {
        this.#failureTimestamps.push(Date.now());
    }

    reset(): void {
        this.#successTimestamps = [];
        this.#failureTimestamps = [];
        this.resetSuccessOnHalfOpen();
    }

    resetSuccessOnHalfOpen() {
        this.#successTimestampsOnHalfOpen = [];
    }

    #filterWithinWindow(timestamps: number[]): number[] {
        const cutoffTime = Date.now() - this.windowSizeMs;
        const validIndex = timestamps.findIndex(timestamp => timestamp >= cutoffTime);
        return validIndex !== -1 ? timestamps.slice(validIndex) : [];
    }
}
