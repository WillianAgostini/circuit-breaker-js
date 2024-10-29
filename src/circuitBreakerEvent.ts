import { EventEmitter } from "node:events";

export class CircuitBreakerEvent extends EventEmitter {

    emit(event: 'open'): boolean;
    emit(event: 'close'): boolean;
    emit(event: 'halfOpen'): boolean;
    emit(event: 'reject'): boolean;
    emit(event: 'success', response: any): boolean;
    emit(event: 'error', err: any): boolean;
    emit(event: string, ...args: any[]): boolean {
      return super.emit(event, ...args);
    }
  
    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'halfOpen', listener: () => void): this;
    on(event: 'reject', listener: () => void): this;
    on(event: 'success', listener: (response: any) => void): this;
    on(event: 'error', listener: (err: any) => void): this;
    on(event: string, listener: (...args: any[]) => void): this {
      return super.on(event, listener);
    }

}