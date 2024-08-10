const { kv } = require('@vercel/kv');

let cachedTokens = null;
let lastFetchTime = 0;
let cachedRefreshStatus = null;
let localTokenCache = null;
let lastRefreshStatusFetchTime = 0;
const CACHE_DURATION = 3600000; // 1 hour cache duration in milliseconds
const REFRESH_STATUS_CACHE_DURATION = 60000; // 1 minute cache duration for refresh status

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
  try {
    // 尝试从 KV 获取 tokens
    const tokens = await originalGetTokensLogic();
    localTokenCache = tokens;  // 更新本地缓存
    return tokens;
  } catch (error) {
    if (error.message.includes('ERR max daily request limit exceeded')) {
      console.log('KV daily limit exceeded, using local cache');
      if (localTokenCache) {
        return localTokenCache;  // 使用本地缓存
      }
      throw new Error('No tokens available in local cache');
    }
    throw error;  // 如果是其他错误，继续抛出
  }
}

async function getRefreshStatus() {
  const currentTime = Date.now();

  if (cachedRefreshStatus && (currentTime - lastRefreshStatusFetchTime < REFRESH_STATUS_CACHE_DURATION)) {
    return cachedRefreshStatus;
  }

  console.log('Fetching refresh status from KV');
  const status = await HAILUO_KV.get('last_token_refresh');

  cachedRefreshStatus = status;
  lastRefreshStatusFetchTime = currentTime;

  return status;
}

async function setRefreshStatus(status) {
  await HAILUO_KV.set('last_token_refresh', status);
  cachedRefreshStatus = status;
  lastRefreshStatusFetchTime = Date.now();
}

async function clearTokenCache() {
  cachedTokens = null;
  lastFetchTime = 0;
  console.log('Token cache cleared');
}

module.exports = {
  HAILUO_KV,
  getTokens,
  getRefreshStatus,
  setRefreshStatus,
  clearTokenCache
};
