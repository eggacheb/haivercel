const { HAILUO_KV } = require('./kv-store');

class APISelector {
  constructor() {
    // 从环境变量读取 API URLs
    this.apis = (process.env.API_URLS || '').split(',')
      .filter(url => url.trim()) // 过滤掉空字符串
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
    // 如果只有一个 API，直接返回
    if (this.apis.length === 1) {
      return this.apis[0].url;
    }

    // 以下是多个 API 的选择逻辑，虽然在这个场景下不会被使用，但保留以备将来扩展
    this.apis.forEach(api => {
      api.weight = 1 / (api.averageResponseTime || 1000);
    });
    this.totalWeight = this.apis.reduce((sum, api) => sum + api.weight, 0);

    const rand = Math.random() * this.totalWeight;
    let sum = 0;
    for (const api of this.apis) {
      sum += api.weight;
      if (rand < sum) {
        return api.url;
      }
    }
    return this.apis[0].url;
  }

  async updateResponseTime(url, responseTime) {
    const api = this.apis.find(a => a.url === url);
    if (api) {
      const alpha = 0.2;
      api.averageResponseTime = api.averageResponseTime 
        ? (1 - alpha) * api.averageResponseTime + alpha * responseTime
        : responseTime;
      
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
    }
  }
}

module.exports = new APISelector();
