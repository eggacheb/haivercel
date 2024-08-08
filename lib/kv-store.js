const { kv } = require('@vercel/kv');

let cachedTokens = null;
let lastFetchTime = 0;
const CACHE_DURATION = 3600000; // 1 hour cache duration in milliseconds

const HAILUO_KV = {
  async get(key) {
    return await kv.get(key);
  },
  async set(key, value) {
    await kv.set(key, value);
  },
  async delete(key) {
    await kv.del(key);
  },
  async list({ prefix }) {
    const keys = await kv.keys(prefix + '*');
    return keys.map(key => ({ name: key }));
  }
};

async function getTokens() {
  const currentTime = Date.now();
  
  if (cachedTokens && (currentTime - lastFetchTime < CACHE_DURATION)) {
    return cachedTokens;
  }

  console.log('Fetching new tokens from KV');
  const tokenList = await HAILUO_KV.list({ prefix: 'token:' });
  const tokens = await Promise.all(tokenList.map(key => HAILUO_KV.get(key.name)));

  cachedTokens = tokens;
  lastFetchTime = currentTime;

  return tokens;
}

module.exports = {
  HAILUO_KV,
  getTokens
};