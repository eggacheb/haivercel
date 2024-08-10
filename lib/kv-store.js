const { kv } = require('@vercel/kv');

let localTokenCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 3600000; // 1 hour cache duration in milliseconds

const HAILUO_KV = {
  async get(key) {
    console.log(`KV GET operation: ${key}`);
    const value = await kv.get(key);
    console.log(`KV GET result for ${key}: ${value ? 'Value found' : 'Value not found'}`);
    return value;
  },
  async set(key, value) {
    console.log(`KV SET operation: ${key}`);
    await kv.set(key, value);
    console.log(`KV SET completed for ${key}`);
  },
  async delete(key) {
    console.log(`KV DELETE operation: ${key}`);
    await kv.del(key);
    console.log(`KV DELETE completed for ${key}`);
  },
  async list({ prefix }) {
    console.log(`KV LIST operation with prefix: ${prefix}`);
    const keys = await kv.keys(prefix + '*');
    console.log(`KV LIST result: Found ${keys.length} keys`);
    return keys.map(key => ({ name: key }));
  }
};

async function getAllTokens() {
  const currentTime = Date.now();
  
  if (localTokenCache && (currentTime - lastFetchTime < CACHE_DURATION)) {
    console.log('Using cached tokens');
    console.log(`Cache age: ${(currentTime - lastFetchTime) / 1000} seconds`);
    console.log(`Number of cached tokens: ${localTokenCache.length}`);
    return localTokenCache;
  }

  console.log('Cache miss or expired, fetching new tokens');
  try {
    console.log('Fetching all tokens from KV');
    const tokenList = await HAILUO_KV.list({ prefix: 'token:' });
    console.log(`Found ${tokenList.length} token keys`);
    
    const tokens = await Promise.all(tokenList.map(key => HAILUO_KV.get(key.name)));
    console.log(`Successfully fetched ${tokens.length} tokens`);

    localTokenCache = tokens; // 更新本地缓存
    lastFetchTime = currentTime;
    console.log('Local cache updated with new tokens');

    return tokens;
  } catch (error) {
    console.error('Error fetching tokens from KV:', error);
    
    if (error.message.includes('ERR max daily request limit exceeded')) {
      console.log('KV daily limit exceeded, attempting to use local cache');
      if (localTokenCache) {
        console.log(`Using local cache as fallback. Cache age: ${(currentTime - lastFetchTime) / 1000} seconds`);
        return localTokenCache; // 使用本地缓存
      }
      console.log('No local cache available for fallback');
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
  console.log('Fetching refresh status');
  const status = await HAILUO_KV.get('last_token_refresh');
  console.log(`Refresh status: ${JSON.stringify(status)}`);
  return status;
}

async function setRefreshStatus(status) {
  console.log(`Setting refresh status: ${JSON.stringify(status)}`);
  await HAILUO_KV.set('last_token_refresh', status);
  console.log('Refresh status updated');
}

module.exports = {
  HAILUO_KV,
  getAllTokens,
  clearTokenCache,
  getRefreshStatus,
  setRefreshStatus
};
