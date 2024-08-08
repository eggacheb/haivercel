const express = require('express');
const fetch = require('node-fetch');
const { kv } = require('@vercel/kv');

const app = express();
app.use(express.json());

// API URLs with performance tracking
const apiUrls = [
    { url: 'http://114.55.108.131:8005/v1/audio/speech', latency: 1000, weight: 1 },
    { url: 'http://8.134.254.175:8000/v1/audio/speech', latency: 1000, weight: 1 },
    { url: 'http://101.43.82.93:8000/v1/audio/speech', latency: 1000, weight: 1 },
    { url: 'http://47.120.26.72:8003/v1/audio/speech', latency: 1000, weight: 1 },
    { url: 'http://111.92.240.57:8007/v1/audio/speech', latency: 1000, weight: 1 },
    { url: 'https://hailuo-free.caizhi-ai.top/v1/audio/speech', latency: 1000, weight: 1 }
  ];

// Global variables for caching tokens
let cachedTokens = null;
let lastFetchTime = 0;
const CACHE_DURATION = 3600000; // 1 hour cache duration in milliseconds

function updateUrlPerformance(index, newLatency) {
  apiUrls[index].latency = newLatency;
  apiUrls[index].weight = 1000 / newLatency; // Weight is inverse to latency
}

function getWeightedRandomApiUrl() {
  const totalWeight = apiUrls.reduce((sum, url) => sum + url.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < apiUrls.length; i++) {
    random -= apiUrls[i].weight;
    if (random <= 0) {
      return { url: apiUrls[i].url, index: i };
    }
  }
  
  return { url: apiUrls[apiUrls.length - 1].url, index: apiUrls.length - 1 };
}

async function getTokens() {
  const currentTime = Date.now();
  
  if (cachedTokens && (currentTime - lastFetchTime < CACHE_DURATION)) {
    return cachedTokens;
  }

  console.log('Fetching new tokens from KV');
  const tokens = await kv.get('tokens');

  if (tokens) {
    cachedTokens = tokens;
    lastFetchTime = currentTime;
  } else {
    cachedTokens = [];
    lastFetchTime = 0;
  }

  return cachedTokens;
}

async function updateTokens(newTokens) {
  await kv.set('tokens', newTokens);
  cachedTokens = newTokens;
  lastFetchTime = Date.now();
}

app.post('/v1/token', async (req, res) => {
  console.log('Handling token renewal');

  let oldToken = req.headers.token || req.body.token;

  if (!oldToken) {
    return res.status(400).send('Token is required');
  }

  console.log('Old token received:', oldToken);

  const newToken = await refreshToken(oldToken);

  if (!newToken) {
    return res.status(500).send('Failed to refresh token');
  }

  console.log('New token received:', newToken);

  try {
    const tokens = await getTokens();
    tokens.push(newToken);
    await updateTokens(tokens);
    console.log('New token stored in KV and cache');
  } catch (e) {
    console.log('Error storing token:', e);
    return res.status(500).send('Error storing token');
  }

  res.json({ 
    message: '上传成功', 
    tokenCount: cachedTokens.length,
    newToken: newToken 
  });
});

app.get('/v1/audio/speech', async (req, res) => {
  console.time('audioSpeechProcessing');
  const { text, voice = 'keli_hailuo', speed = '1' } = req.query;

  if (!text) {
    console.log('Missing text parameter');
    return res.status(400).send('Missing text parameter. Please provide a "text" query parameter.');
  }

  console.log('Received text:', text);

  const { url: apiUrl, index: urlIndex } = getWeightedRandomApiUrl();
  console.log('Selected API URL:', apiUrl);
  
  const tokens = await getTokens();

  if (tokens.length === 0) {
    console.log('No tokens available');
    return res.status(500).send('No tokens available');
  }

  const authorization = tokens.join(',');

  try {
    console.log('Calling external API');
    const startTime = Date.now();
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authorization}`,
        'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "hailuo",
        input: text,
        voice: voice,
        speed: parseFloat(speed)
      })
    });
    const endTime = Date.now();
    const latency = endTime - startTime;

    updateUrlPerformance(urlIndex, latency);

    if (!apiResponse.ok) {
      throw new Error(`API response not OK: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    console.log('Processing audio data');
    const reader = apiResponse.body;
    let totalSize = 0;

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="audio_${Date.now()}.mp3"`);
    res.setHeader('Transfer-Encoding', 'chunked');

    reader.on('data', (chunk) => {
      totalSize += chunk.length;
      res.write(chunk);
    });

    reader.on('end', () => {
      console.log('Audio data size:', totalSize, 'bytes');
      console.log('Audio processing completed');
      console.timeEnd('audioSpeechProcessing');
      res.end();
    });

  } catch (error) {
    console.error('Error in audio processing:', error);
    res.status(500).send('Error processing audio');
  }
});

async function refreshToken(oldToken) {
  const uuid = generateUUID();
  const device_id = generateDeviceID();

  const targetUrl = new URL('https://hailuoai.com/v1/api/user/renewal');
  targetUrl.searchParams.append('device_platform', 'web');
  targetUrl.searchParams.append('app_id', '3001');
  targetUrl.searchParams.append('uuid', uuid);
  targetUrl.searchParams.append('device_id', device_id);
  targetUrl.searchParams.append('version_code', '22200');
  targetUrl.searchParams.append('os_name', 'Windows');
  targetUrl.searchParams.append('browser_name', 'chrome');
  targetUrl.searchParams.append('server_version', '101');
  targetUrl.searchParams.append('device_memory', '8');
  targetUrl.searchParams.append('cpu_core_num', '12');
  targetUrl.searchParams.append('browser_language', 'en');
  targetUrl.searchParams.append('browser_platform', 'Win32');
  targetUrl.searchParams.append('screen_width', '1536');
  targetUrl.searchParams.append('screen_height', '864');
  targetUrl.searchParams.append('unix', Date.now().toString());

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': oldToken,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
    const responseJson = await response.json();
    return responseJson.data.token;
  } catch (e) {
    console.log('Error refreshing token:', e);
    return null;
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateDeviceID() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = { app, getTokens, updateTokens, refreshToken };