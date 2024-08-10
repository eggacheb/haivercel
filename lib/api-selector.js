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

  selectAPI() {
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
        console.log(`Selected API URL: ${api.url}`);
        return api.url;
      }
    }
    console.log(`Fallback to first API URL: ${this.apis[0].url}`);
    return this.apis[0].url;
  }

  updateResponseTime(url, responseTime) {
    const api = this.apis.find(a => a.url === url);
    if (api) {
      const alpha = 0.2;
      api.averageResponseTime = api.averageResponseTime 
        ? (1 - alpha) * api.averageResponseTime + alpha * responseTime
        : responseTime;
      
      console.log(`Updated response time for ${url}: ${api.averageResponseTime.toFixed(2)}ms`);
    }
  }
}

module.exports = new APISelector();
