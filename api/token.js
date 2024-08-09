const { handleTokenRenewal, refreshAllTokens } = require('../lib/token-utils');
const apiSelector = require('../lib/api-selector');

module.exports = async (req, res) => {
  try {
    await apiSelector.loadResponseTimes();

    if (req.method === 'POST') {
      await handleTokenRenewal(req, res);
    } else if (req.method === 'GET' && req.query.action === 'refresh') {
      await refreshAllTokens();
      res.status(200).json({ message: 'Token refresh completed' });
    } else if (req.method === 'POST' && req.query.action === 'manual-refresh') {
      await refreshAllTokens();
      res.status(200).json({ message: 'Manual token refresh completed' });
    } else {
      res.status(405).send(`Method ${req.method} not allowed. Use POST for token renewal, GET with action=refresh for scheduled refresh, or POST with action=manual-refresh for manual refresh.`);
    }
  } catch (error) {
    console.error('Error in token handling:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
