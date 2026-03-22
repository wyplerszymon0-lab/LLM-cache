const { LLMCache } = require("../src/cache");

const MODEL = "gpt-4o-mini";
const MESSAGES = [{ role: "user", content: "Hello" }];
const RESPONSE = "Hi there!";

test("returns null on cache miss", () => {
  const cache = new LLMCache();
  expect(cache.get(MODEL, MESSAGES)).toBeNull();
});

test("returns cached response on hit", () => {
  const cache = new LLMCache();
  cache.set(MODEL, MESSAGES, RESPONSE, 50);
  expect(cache.get(MODEL, MESSAGES)).toBe(RESPONSE);
});

test("different messages produce different cache keys", () => {
  const cache = new LLMCache();
  const msgs1 = [{ role: "user", content: "Hello" }];
  const msgs2 = [{ role: "user", content: "Goodbye" }];
  cache.set(MODEL, msgs1, "response1", 10);
  cache.set(MODEL, msgs2, "response2", 10);
  expect(cache.get(MODEL, msgs1)).toBe("response1");
  expect(cache.get(MODEL, msgs2)).toBe("response2");
});

test("different models produce different cache keys", () => {
  const cache = new LLMCache();
  cache.set("gpt-4o-mini", MESSAGES, "mini response", 10);
  cache.set("gpt-4o", MESSAGES, "large response", 10);
  expect(cache.get("gpt-4o-mini", MESSAGES)).toBe("mini response");
  expect(cache.get("gpt-4o", MESSAGES)).toBe("large response");
});

test("expired entries return null", async () => {
  const cache = new LLMCache({ ttlMs: 10 });
  cache.set(MODEL, MESSAGES, RESPONSE, 50);
  await new Promise(r => setTimeout(r, 20));
  expect(cache.get(MODEL, MESSAGES)).toBeNull();
});

test("stats track hits and misses", () => {
  const cache = new LLMCache();
  cache.get(MODEL, MESSAGES);
  cache.set(MODEL, MESSAGES, RESPONSE, 100);
  cache.get(MODEL, MESSAGES);
  const stats = cache.getStats();
  expect(stats.hits).toBe(1);
  expect(stats.misses).toBe(1);
  expect(stats.tokensSaved).toBe(100);
});

test("hit rate calculated correctly", () => {
  const cache = new LLMCache();
  cache.set(MODEL, MESSAGES, RESPONSE, 10);
  cache.get(MODEL, MESSAGES);
  cache.get(MODEL, MESSAGES);
  cache.get(MODEL, [{ role: "user", content: "other" }]);
  const stats = cache.getStats();
  expect(stats.hitRate).toBeCloseTo(2 / 3);
});

test("evicts oldest entry when maxSize reached", () => {
  const cache = new LLMCache({ maxSize: 2 });
  const msgs = i => [{ role: "user", content: `msg ${i}` }];
  cache.set(MODEL, msgs(1), "r1", 10);
  cache.set(MODEL, msgs(2), "r2", 10);
  cache.set(MODEL, msgs(3), "r3", 10);
  expect(cache.size()).toBe(2);
  expect(cache.getStats().evictions).toBe(1);
});

test("invalidate removes specific entry", () => {
  const cache = new LLMCache();
  cache.set(MODEL, MESSAGES, RESPONSE, 10);
  cache.invalidate(MODEL, MESSAGES);
  expect(cache.get(MODEL, MESSAGES)).toBeNull();
});

test("clear resets store and stats", () => {
  const cache = new LLMCache();
  cache.set(MODEL, MESSAGES, RESPONSE, 10);
  cache.get(MODEL, MESSAGES);
  cache.clear();
  expect(cache.size()).toBe(0);
  expect(cache.getStats().hits).toBe(0);
});

test("purgeExpired removes only stale entries", async () => {
  const cache = new LLMCache({ ttlMs: 20 });
  const freshMsgs = [{ role: "user", content: "fresh" }];
  cache.set(MODEL, MESSAGES, "stale", 10);
  await new Promise(r => setTimeout(r, 30));
  cache.set(MODEL, freshMsgs, "fresh", 10);
  const purged = cache.purgeExpired();
  expect(purged).toBe(1);
  expect(cache.size()).toBe(1);
  expect(cache.get(MODEL, freshMsgs)).toBe("fresh");
});

test("options included in cache key", () => {
  const cache = new LLMCache();
  cache.set(MODEL, MESSAGES, "temp07", 10, { temperature: 0.7 });
  cache.set(MODEL, MESSAGES, "temp09", 10, { temperature: 0.9 });
  expect(cache.get(MODEL, MESSAGES, { temperature: 0.7 })).toBe("temp07");
  expect(cache.get(MODEL, MESSAGES, { temperature: 0.9 })).toBe("temp09");
});

test("tokens saved accumulates across hits", () => {
  const cache = new LLMCache();
  cache.set(MODEL, MESSAGES, RESPONSE, 200);
  cache.get(MODEL, MESSAGES);
  cache.get(MODEL, MESSAGES);
  expect(cache.getStats().tokensSaved).toBe(400);
});
