export class Window {
    #successTimestamps: number[] = [];
    #failureTimestamps: number[] = [];
    #successOnHalfOpen: number[] = [];
    #failureOnHalfOpen: number[] = [];

    constructor(private readonly windowSizeMs: number) {}

    get successCount(): number {
        this.#successTimestamps = this.#filterWithinWindow(this.#successTimestamps);
        return this.#successTimestamps.length;
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

    get successCountOnHalfOpen(): number {
        return this.#successOnHalfOpen.length;
    }

    get failureCountOnHalfOpen(): number {
        return this.#failureOnHalfOpen.length;
    }

    recordSuccess(): void {
        this.#successTimestamps.push(Date.now());
    }

    recordFailure(): void {
        this.#failureTimestamps.push(Date.now());
    }

    recordSuccessOnHalfOpen(): void {
        this.#successOnHalfOpen.push(Date.now());
    }
    
    recordFailureOnHalfOpen(): void {
        this.#failureOnHalfOpen.push(Date.now());
    }

    reset(): void {
        this.#successTimestamps = [];
        this.#failureTimestamps = [];
        this.resetSuccessOnHalfOpen();
        this.#failureOnHalfOpen = [];
    }

    resetSuccessOnHalfOpen() {
        this.#successOnHalfOpen = [];
    }

    #filterWithinWindow(timestamps: number[]): number[] {
        const cutoffTime = Date.now() - this.windowSizeMs;
        let idx = 0;
        while (idx < timestamps.length && timestamps[idx] < cutoffTime) {
            idx++;
        }
        if (idx > 0) {
            timestamps.splice(0, idx);
        }
        return timestamps;
    }
}
