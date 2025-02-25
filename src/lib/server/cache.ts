type CacheEntry<T> = {
    value: T;
    lastAccessedAt: number;
}

export class Cache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private ttl: number;
    private maxSize: number;

    constructor(ttl: number = 5 * 60 * 1000, maxSize: number = 100) {
        this.ttl = ttl;
        this.maxSize = maxSize;
    }

    has(key: string): boolean {
        if (!this.cache.has(key)) {
            return false
        }

        // Also need to check if the entry is expired
        const en = this.cache.get(key)!
        return !this.isExpired(en)
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);

        if (entry && !this.isExpired(entry)) {
            this.cache.set(key, { ...entry, lastAccessedAt: Date.now() });
            return entry.value;
        } else {
            this.cache.delete(key);
            return null;
        }
    }

    put(key: string, value: T): void {
        if (this.cache.size >= this.maxSize) {
            this.removeOldest();
        }
        this.cache.set(key, { value, lastAccessedAt: Date.now() });
    }

    remove(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    private removeOldest(): void {
        let oldestKey: string | undefined;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessedAt < oldestTime) {
                oldestTime = entry.lastAccessedAt;
                oldestKey = key;
            }
        }

        if (oldestKey !== undefined) {
            this.cache.delete(oldestKey);
        }
    }

    private isExpired(entry: CacheEntry<T>): boolean {
        return Date.now() - entry.lastAccessedAt > this.ttl;
    }
}
