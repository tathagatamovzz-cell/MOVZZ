interface CacheItem {
  value: string;
  expiresAt: number;
}

class MemoryCache {
  private store: Map<string, CacheItem> = new Map();

  async set(key: string, value: string, expirySeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + expirySeconds * 1000
    });
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const redis = new MemoryCache();
export default redis;