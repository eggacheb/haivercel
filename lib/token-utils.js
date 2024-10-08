const https = require('https');
const http = require('http');
const { HAILUO_KV, getAllTokens, setRefreshStatus, clearTokenCache } = require('./kv-store');
const apiSelector = require('./api-selector');

function removeBrackets(text) {
  // 移除中文括号 （）但保留内容
  text = text.replace(/（(.+?)）/g, '$1');
  // 移除英文括号 () 但保留内容
  text = text.replace(/\((.+?)\)/g, '$1');
  return text.trim();
}

async function handleTokenRenewal(req, res) {
  console.log('Handling token renewal');

  let oldToken = req.headers.token || (req.body && req.body.token);

  if (!oldToken) {
    console.log('No token provided in request');
    return res.status(400).json({ error: 'Token is required' });
  }

  console.log('Old token received:', oldToken);

  try {
    const newToken = await refreshToken(oldToken);

    if (!newToken) {
      console.log('Failed to refresh token');
      return res.status(500).json({ error: 'Failed to refresh token' });
    }

    console.log('New token received:', newToken);

    try {
      await HAILUO_KV.set('token:' + Date.now(), newToken);
      console.log('New token stored in KV');
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
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Error refreshing token' });
  }
}

async function handleAudioSpeech(req, res) {
  console.log(`Handling audio speech request`);
  console.time('audioSpeechProcessing');
  const { text: originalText, voice = 'keli_hailuo', speed = '1' } = req.query;

  console.log('Received request URL:', req.url);

  if (!originalText) {
    console.log('Missing text parameter');
    console.timeEnd('audioSpeechProcessing');
    return res.status(400).send('Missing text parameter. Please provide a "text" query parameter.');
  }

  // 处理文本，移除括号
  const text = removeBrackets(originalText);
  console.log('Original text:', originalText);
  console.log('Processed text:', text);

  const apiUrl = apiSelector.selectAPI();
  console.log(`Selected API URL: ${apiUrl}`);
  
  console.log('Fetching all tokens');
  let tokens;
  try {
    tokens = await getAllTokens();
  } catch (error) {
    console.error('Error fetching tokens:', error);
    console.timeEnd('audioSpeechProcessing');
    return res.status(500).send('Error fetching tokens');
  }

  if (tokens.length === 0) {
    console.log('No tokens available');
    console.timeEnd('audioSpeechProcessing');
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
        console.timeEnd('audioSpeechProcessing');
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
      console.timeEnd('audioSpeechProcessing');
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
  console.log(`[${new Date().toISOString()}] Starting scheduled token refresh`);

  const tokenList = await HAILUO_KV.list({ prefix: 'token:' });
  console.log(`Found ${tokenList.length} tokens to refresh`);
  
  let successCount = 0;
  let failCount = 0;

  for (const key of tokenList) {
    const oldToken = await HAILUO_KV.get(key.name);
    console.log(`Refreshing token: ${key.name}`);
    try {
      const newToken = await refreshToken(oldToken);

      if (newToken) {
        await HAILUO_KV.set(key.name, newToken);
        console.log(`Successfully refreshed token: ${key.name}`);
        successCount++;
      } else {
        console.log(`Failed to refresh token: ${key.name}`);
        failCount++;
      }
    } catch (error) {
      console.error(`Error refreshing token ${key.name}:`, error);
      failCount++;
    }
  }

  console.log(`[${new Date().toISOString()}] Scheduled token refresh completed`);
  console.log(`Successful refreshes: ${successCount}, Failed refreshes: ${failCount}`);

  const refreshStatus = {
    timestamp: new Date().toISOString(),
    successCount,
    failCount
  };

  try {
    await setRefreshStatus(refreshStatus);
    console.log('Refresh status saved to KV storage');
  } catch (error) {
    console.error('Failed to save refresh status to KV storage:', error);
  }

  await clearTokenCache();
}

module.exports = {
  handleTokenRenewal,
  handleAudioSpeech,
  refreshToken,
  refreshAllTokens
};
