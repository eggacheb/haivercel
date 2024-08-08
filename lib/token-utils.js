const https = require('https');
const http = require('http');
const { HAILUO_KV, getTokens } = require('./kv-store');
const apiSelector = require('./api-selector');

async function handleTokenRenewal(req, res) {
  console.log('Handling token renewal');

  let oldToken = req.headers.token || req.body.token;

  if (!oldToken) {
    return res.status(400).json({ error: 'Token is required' });
  }

  console.log('Old token received:', oldToken);

  const newToken = await refreshToken(oldToken);

  if (!newToken) {
    return res.status(500).json({ error: 'Failed to refresh token' });
  }

  console.log('New token received:', newToken);

  try {
    await HAILUO_KV.set('token:' + Date.now(), newToken);
    console.log('New token stored in KV');
    
    // Clear cache to fetch latest tokens next time
    cachedTokens = null;
    lastFetchTime = 0;
  } catch (e) {
    console.log('Error storing token in KV:', e);
    return res.status(500).json({ error: 'Error storing token' });
  }

  const tokenList = await HAILUO_KV.list({ prefix: 'token:' });
  const tokenCount = tokenList.length;

  res.status(200).json({ 
    message: '上传成功', 
    tokenCount: tokenCount,
    newToken: newToken 
  });
}

async function handleAudioSpeech(req, res) {
  console.time('audioSpeechProcessing');
  const { text, voice = 'keli_hailuo', speed = '1' } = req.query;

  console.log('Received request URL:', req.url);

  if (!text) {
    console.log('Missing text parameter');
    return res.status(400).send('Missing text parameter. Please provide a "text" query parameter.');
  }

  console.log('Received text:', text);

  const apiUrl = await apiSelector.selectAPI();
  
  console.log('Fetching tokens');
  const tokens = await getTokens();

  if (tokens.length === 0) {
    console.log('No tokens available');
    return res.status(500).send('No tokens available');
  }

  const authorization = tokens.join(',');

  const postData = JSON.stringify({
    model: "hailuo",
    input: text,
    voice: voice,
    speed: parseFloat(speed)
  });

  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authorization}`,
      'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = apiUrl.startsWith('https') ? https : http;
    const apiReq = protocol.request(apiUrl, options, (apiRes) => {
      if (apiRes.statusCode !== 200) {
        res.status(apiRes.statusCode).send(`API response not OK: ${apiRes.statusCode} ${apiRes.statusMessage}`);
        resolve();
        return;
      }

      console.log('Processing audio data');
      const fileName = `audio_${Date.now()}.mp3`;
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Transfer-Encoding', 'chunked');

      let totalSize = 0;
      apiRes.on('data', (chunk) => {
        totalSize += chunk.length;
        res.write(chunk);
      });

      apiRes.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        apiSelector.updateResponseTime(apiUrl, responseTime);

        console.log('Audio data size:', totalSize, 'bytes');
        res.end();
        console.log('Audio processing completed');
        console.timeEnd('audioSpeechProcessing');
        resolve();
      });
    });

    apiReq.on('error', (error) => {
      console.error('Error in audio processing:', error);
      res.status(500).send(`Error in audio processing: ${error.message}`);
      resolve();
    });

    apiReq.write(postData);
    apiReq.end();
  });
}

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

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Token': oldToken,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Accept-Encoding': 'gzip, deflate, br'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(targetUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const responseJson = JSON.parse(data);
          resolve(responseJson.data.token);
        } catch (e) {
          console.log('Error parsing response:', e);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.log('Error refreshing token:', error);
      reject(error);
    });

    req.end();
  });
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

async function refreshAllTokens() {
  console.log('Running scheduled token refresh');

  const tokenList = await HAILUO_KV.list({ prefix: 'token:' });
  
  for (const key of tokenList) {
    const oldToken = await HAILUO_KV.get(key.name);
    const newToken = await refreshToken(oldToken);

    if (newToken) {
      await HAILUO_KV.set(key.name, newToken);
      console.log(`Refreshed token: ${key.name}`);
    } else {
      console.log(`Failed to refresh token: ${key.name}`);
    }
  }

  // Clear cache to fetch latest tokens next time
  cachedTokens = null;
  lastFetchTime = 0;

  console.log('Scheduled token refresh completed');
}

module.exports = {
  handleTokenRenewal,
  handleAudioSpeech,
  refreshToken,
  refreshAllTokens
};