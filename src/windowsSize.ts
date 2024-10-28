export class WindowsSize {
    #success: number[] = [];
    #fail: number[] = [];

    constructor(private windowSize: number) { }

    public get success(): number {
        this.#success = this.#removeOutOfWindowsSize(this.#success);
        return this.#success.length;
    }

    public get fail(): number {
        this.#fail = this.#removeOutOfWindowsSize(this.#fail);
        return this.#fail.length;
    }

    public get totalRequests(): number {
        return this.success + this.fail;
    }

    public get failedPercent() {
        const totalRequests = this.totalRequests;
        const percent = (this.fail * 100) / totalRequests;
        return percent || 0;
    }

    pushSuccess() {
        this.#success.push(Date.now());
    }

    pushFail() {
        this.#fail.push(Date.now());
    }

    reset() {
        this.#success = [];
        this.#fail = [];
    }

    #removeOutOfWindowsSize(arr: number[]) {
        const windowSizeDate = Date.now() - this.windowSize;
        let index = arr.findIndex(timestamp => timestamp >= windowSizeDate);
        if (index == -1) {
            index = arr.length;
        }
        if (index > 0) {
            return arr.slice(index);
        }
        return arr;
    }

}
