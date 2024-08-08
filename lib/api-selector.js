const { HAILUO_KV } = require('./kv-store');

class APISelector {
  constructor() {
    this.apis = [
      { url: 'http://114.55.108.131:8005/v1/audio/speech', weight: 1, averageResponseTime: 1000 },
      { url: 'http://8.134.254.175:8000/v1/audio/speech', weight: 1, averageResponseTime: 1000 },
      { url: 'http://101.43.82.93:8000/v1/audio/speech', weight: 1, averageResponseTime: 1000 },
      { url: 'http://47.120.26.72:8003/v1/audio/speech', weight: 1, averageResponseTime: 1000 },
      { url: 'http://111.92.240.57:8007/v1/audio/speech', weight: 1, averageResponseTime: 1000 },
      { url: 'https://hailuo-free.caizhi-ai.top/v1/audio/speech', weight: 1, averageResponseTime: 1000 },
    ];
    this.totalWeight = this.apis.reduce((sum, api) => sum + api.weight, 0);
  }

  async selectAPI() {
    // 使用指数加权移动平均（EWMA）来平滑权重
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
    return this.apis[0].url; // Fallback to first API
  }

  async updateResponseTime(url, responseTime) {
    const api = this.apis.find(a => a.url === url);
    if (api) {
      // 使用指数加权移动平均（EWMA）来更新平均响应时间
      const alpha = 0.2; // 平滑因子，可以根据需要调整
      api.averageResponseTime = api.averageResponseTime 
        ? (1 - alpha) * api.averageResponseTime + alpha * responseTime
        : responseTime;
      
      // 存储更新后的平均响应时间
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