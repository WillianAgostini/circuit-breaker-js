import { EventEmitter } from "node:events";

type CircuitBreakerEvents = 
    | 'open'
    | 'close'
    | 'halfOpen'
    | 'reject'
    | 'success'
    | 'error';

export class CircuitBreakerEvent extends EventEmitter {
    
    emit(event: 'open' | 'close' | 'halfOpen' | 'reject'): boolean;
    emit(event: 'success', response: any): boolean;
    emit(event: 'error', err: any): boolean;
    emit(event: CircuitBreakerEvents, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }

    on(event: 'open' | 'close' | 'halfOpen' | 'reject', listener: () => void): this;
    on(event: 'success', listener: (response: any) => void): this;
    on(event: 'error', listener: (err: any) => void): this;
    on(event: CircuitBreakerEvents, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }
}
