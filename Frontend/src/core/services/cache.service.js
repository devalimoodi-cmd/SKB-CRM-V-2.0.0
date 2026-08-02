const CACHE_PREFIX = "skb_cache_";
const DEFAULT_TTL = 5 * 60 * 1000; // ۵ دقیقه

export class CacheService {
  constructor() {
    this.prefix = CACHE_PREFIX;
    this.defaultTTL = DEFAULT_TTL;
    this.memoryCache = new Map();
  }

  _getKey(key) {
    return `${this.prefix}${key}`;
  }

  set(key, data, ttl = this.defaultTTL) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(this._getKey(key), JSON.stringify(cacheData));
      this.memoryCache.set(key, cacheData);
      return true;
    } catch (error) {
      console.warn("⚠️ Cache set error:", error);
      return false;
    }
  }

  get(key) {
    try {
      if (this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        const age = Date.now() - cached.timestamp;
        if (age < cached.ttl) {
          return cached.data;
        }
        this.memoryCache.delete(key);
      }

      const raw = localStorage.getItem(this._getKey(key));
      if (!raw) return null;

      const cacheData = JSON.parse(raw);
      const age = Date.now() - cacheData.timestamp;

      if (age > cacheData.ttl) {
        this.remove(key);
        return null;
      }

      this.memoryCache.set(key, cacheData);
      return cacheData.data;
    } catch (error) {
      this.remove(key);
      return null;
    }
  }

  remove(key) {
    localStorage.removeItem(this._getKey(key));
    this.memoryCache.delete(key);
  }

  clear() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) {
        keys.push(k);
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
    this.memoryCache.clear();
  }

  invalidate(pattern) {
    const fullPattern = this._getKey(pattern);
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPattern)) {
        keys.push(k);
      }
    }
    keys.forEach((k) => {
      localStorage.removeItem(k);
      const key = k.replace(this.prefix, "");
      this.memoryCache.delete(key);
    });
  }

  isValid(key) {
    return this.get(key) !== null;
  }

  async fetchWithCache(
    url,
    options = {},
    cacheKey = null,
    ttl = this.defaultTTL,
  ) {
    const key = cacheKey || url;
    const cached = this.get(key);
    if (cached) {
      return cached;
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (data && data.success !== false) {
      this.set(key, data, ttl);
    }

    return data;
  }
}

// ✅ Export instance برای استفاده
export const cacheService = new CacheService();
