const crypto = require("crypto");

class CacheEntry {
  constructor(response, tokensUsed) {
    this.response = response;
    this.tokensUsed = tokensUsed;
    this.createdAt = Date.now();
    this.hits = 0;
  }
}

class LLMCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? 1000 * 60 * 60;
    this.maxSize = options.maxSize ?? 500;
    this.store = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0, tokensSaved: 0 };
  }

  _hashKey(model, messages, options = {}) {
    const payload = JSON.stringify({ model, messages, options });
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  get(model, messages, options = {}) {
    const key = this._hashKey(model, messages, options);
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    this.stats.tokensSaved += entry.tokensUsed;
    return entry.response;
  }

  set(model, messages, response, tokensUsed = 0, options = {}) {
    const key = this._hashKey(model, messages, options);

    if (this.store.size >= this.maxSize) {
      this._evictOldest();
    }

    this.store.set(key, new CacheEntry(response, tokensUsed));
  }

  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  invalidate(model, messages, options = {}) {
    const key = this._hashKey(model, messages, options);
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, tokensSaved: 0 };
  }

  purgeExpired() {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.createdAt > this.ttlMs) {
        this.store.delete(key);
        purged++;
      }
    }
    return purged;
  }

  size() {
    return this.store.size;
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? (this.stats.hits / total) : 0,
    };
  }
}

module.exports = { LLMCache };
