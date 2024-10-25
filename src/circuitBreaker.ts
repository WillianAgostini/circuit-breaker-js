import { Options } from "./interfaces";
import { State } from "./state";

export class CircuitBreaker {
    private readonly currentState: State;
    constructor(private opts: Options) {
        this.currentState = new State(opts);
    }

    isOpen = () => this.currentState.isOpen;
    isClose = () => this.currentState.isClose;
    isHalfOpen = () => this.currentState.isHalfOpen;
    open = () => this.currentState.setOpen();
    close = () => this.currentState.setClose();
    halfOpen = () => this.currentState.setHalfOpen();

    async execute(promise: Promise<unknown>) {
        const timeoutPromise = this.getRejectTimeout();
        try {
            const response = await Promise.race([promise, timeoutPromise]);
            if(this.isHalfOpen()) {
                this.close();
            }
            return response;
        } catch (error) {
            this.currentState.setOpen()
            throw error;
        }
    }

    private getRejectTimeout() {
        if (!this.opts.timeout) return undefined;
        return new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), this.opts.timeout));
    }
}
