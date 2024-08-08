const { handleTokenRenewal, refreshAllTokens } = require('../lib/token-utils');
const apiSelector = require('../lib/api-selector');

module.exports = async (req, res) => {
  await apiSelector.loadResponseTimes();

  if (req.method === 'POST') {
    await handleTokenRenewal(req, res);
  } else if (req.method === 'GET' && req.query.action === 'refresh') {
    await refreshAllTokens();
    res.status(200).json({ message: 'Token refresh completed' });
  } else {
    res.status(405).send(`Method ${req.method} not allowed. Use POST for token renewal or GET with action=refresh for refreshing all tokens.`);
  }
};