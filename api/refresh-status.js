const { HAILUO_KV } = require('../lib/kv-store');

module.exports = async (req, res) => {
  try {
    const lastRefresh = await HAILUO_KV.get('last_token_refresh');
    if (lastRefresh) {
      res.status(200).json({
        message: 'Last refresh status retrieved successfully',
        lastRefresh
      });
    } else {
      res.status(404).json({ message: 'No refresh status found' });
    }
  } catch (error) {
    console.error('Error retrieving refresh status:', error);
    res.status(500).json({ message: 'Error retrieving refresh status' });
  }
};
