# llm-cache

A caching layer for LLM API calls. Identical prompts return cached responses instantly — reducing costs and latency for repeated queries.

## Features

- SHA-256 keying — model + messages + options all included in cache key
- TTL-based expiration — configurable time-to-live per entry
- LRU-style eviction — oldest entry removed when max size reached
- Token tracking — see exactly how many tokens saved
- Hit rate stats — monitor cache efficiency
- Manual invalidation and bulk expiry purge

## Usage
```javascript
const { LLMCache } = require("./src/cache");

const cache = new LLMCache({ ttlMs: 3600000, maxSize: 500 });

const messages = [{ role: "user", content: "Explain async/await" }];

const cached = cache.get("gpt-4o-mini", messages);
if (cached) {
  console.log("From cache:", cached);
} else {
  const response = await openai.chat.completions.create({ model: "gpt-4o-mini", messages });
  const content = response.choices[0].message.content;
  cache.set("gpt-4o-mini", messages, content, response.usage.total_tokens);
  console.log("From API:", content);
}

console.log(cache.getStats());
```

## Stats Output
```javascript
{
  hits: 42,
  misses: 8,
  evictions: 2,
  tokensSaved: 18400,
  size: 48,
  hitRate: 0.84
}
```

## Test
```bash
npm install
npm test
```

## Project Structure
```
llm-cache/
├── src/
│   ├── cache.js            # LLMCache core
│   └── cached-client.js    # OpenAI wrapper with built-in cache
├── tests/
│   └── cache.test.js
├── package.json
└── README.md
```

## Author

**Szymon Wypler**
