import { randomUUID } from 'crypto';

export class AbortManager {
    readonly abortControllers = new Map<string, AbortController>();

    create() {
        const id = randomUUID();
        const abortController = new AbortController();
        this.abortControllers.set(id, abortController);
        return { id, abortController };
    }

    abort(id: string, reason?: string): boolean {
        const abortController = this.abortControllers.get(id);
        if (!abortController) return false;

        abortController.abort(reason);
        return this.abortControllers.delete(id);
    }

    abortAll(reason?: string) {
        this.abortControllers.forEach(abortController => abortController.abort(reason));
        this.abortControllers.clear();
    }
}
