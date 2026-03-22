const { LLMCache } = require("./cache");

class CachedOpenAIClient {
  constructor(openaiClient, options = {}) {
    this.client = openaiClient;
    this.cache = new LLMCache(options.cache ?? {});
    this.cacheOptions = options.cacheOptions ?? {};
  }

  async complete(model, messages, options = {}) {
    const { skipCache = false, ...completionOptions } = options;

    if (!skipCache) {
      const cached = this.cache.get(model, messages, completionOptions);
      if (cached !== null) {
        return { content: cached, fromCache: true };
      }
    }

    const response = await this.client.chat.completions.create({
      model,
      messages,
      ...completionOptions,
    });

    const content = response.choices[0]?.message?.content ?? "";
    const tokensUsed = response.usage?.total_tokens ?? 0;

    this.cache.set(model, messages, content, tokensUsed, completionOptions);

    return { content, fromCache: false };
  }

  getStats() {
    return this.cache.getStats();
  }

  clearCache() {
    this.cache.clear();
  }

  purgeExpired() {
    return this.cache.purgeExpired();
  }
}

module.exports = { CachedOpenAIClient };
