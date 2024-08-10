const { kv } = require('@vercel/kv');

let localTokenCache = null;
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

async function getAllTokens() {
  const currentTime = Date.now();
  
  // 如果本地缓存存在且未过期，直接返回本地缓存
  if (localTokenCache && (currentTime - lastFetchTime < CACHE_DURATION)) {
    console.log('Using local token cache');
    return localTokenCache;
  }

  try {
    console.log('Fetching all tokens from KV');
    const tokenList = await HAILUO_KV.list({ prefix: 'token:' });
    const tokens = await Promise.all(tokenList.map(key => HAILUO_KV.get(key.name)));

    localTokenCache = tokens; // 更新本地缓存
    lastFetchTime = currentTime;

    return tokens;
  } catch (error) {
    console.error('Error fetching tokens from KV:', error);
    
    if (error.message.includes('ERR max daily request limit exceeded')) {
      console.log('KV daily limit exceeded, using local cache');
      if (localTokenCache) {
        return localTokenCache; // 使用本地缓存
      }
    }
    
    throw error; // 如果是其他错误或本地缓存也不可用，继续抛出错误
  }
}

function clearTokenCache() {
  localTokenCache = null;
  lastFetchTime = 0;
  console.log('Token cache cleared');
}

async function getRefreshStatus() {
  return await HAILUO_KV.get('last_token_refresh');
}

async function setRefreshStatus(status) {
  await HAILUO_KV.set('last_token_refresh', status);
}

module.exports = {
  HAILUO_KV,
  getAllTokens,
  clearTokenCache,
  getRefreshStatus,
  setRefreshStatus
};
