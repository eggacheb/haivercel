const { HAILUO_KV } = require('./kv-store');

class APISelector {
  constructor() {
    this.apis = (process.env.API_URLS || '').split(',')
      .filter(url => url.trim())
      .map(url => ({
        url: url.trim(),
        weight: 1,
        averageResponseTime: 1000
      }));

    if (this.apis.length === 0) {
      throw new Error('No API URLs found in environment variables. Please set the API_URLS environment variable.');
    }

    this.totalWeight = this.apis.reduce((sum, api) => sum + api.weight, 0);
  }

  async selectAPI() {
    if (this.apis.length === 0) {
      throw new Error('No API URLs available.');
    }

    this.apis.forEach(api => {
      api.weight = 1 / (api.averageResponseTime || 1000);
    });
    this.totalWeight = this.apis.reduce((sum, api) => sum + api.weight, 0);

    const rand = Math.random() * this.totalWeight;
    let sum = 0;
    for (const api of this.apis) {
      sum += api.weight;
      if (rand < sum) {
        console.log(`Selected API URL: ${api.url}`);  // 添加这行来记录选中的 API URL
        return api.url;
      }
    }
    console.log(`Fallback to first API URL: ${this.apis[0].url}`);  // 添加这行来记录回退情况
    return this.apis[0].url;
  }

  async updateResponseTime(url, responseTime) {
    const api = this.apis.find(a => a.url === url);
    if (api) {
      const alpha = 0.2;
      api.averageResponseTime = api.averageResponseTime 
        ? (1 - alpha) * api.averageResponseTime + alpha * responseTime
        : responseTime;
      
      console.log(`Updated response time for ${url}: ${api.averageResponseTime.toFixed(2)}ms`);  // 添加这行来记录更新的响应时间
      
      await HAILUO_KV.set('api_response_times', this.apis.map(a => ({
        url: a.url,
        averageResponseTime: a.averageResponseTime
      })));
    }
  }

  async loadResponseTimes() {
    const storedResponseTimes = await HAILUO_KV.get('api_response_times');
    if (storedResponseTimes) {
      storedResponseTimes.forEach(stored => {
        const api = this.apis.find(a => a.url === stored.url);
        if (api) {
          api.averageResponseTime = stored.averageResponseTime;
        }
      });
      console.log('Loaded stored response times');  // 添加这行来记录加载存储的响应时间
    } else {
      console.log('No stored response times found');  // 添加这行来记录没有找到存储的响应时间
    }
  }
}

module.exports = new APISelector();
