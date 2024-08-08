const { getTokens, updateTokens, refreshToken } = require('../index');

async function handleScheduled() {
  console.log('Running scheduled token refresh');

  const tokens = await getTokens();
  const newTokens = [];

  for (const oldToken of tokens) {
    const newToken = await refreshToken(oldToken);
    if (newToken) {
      newTokens.push(newToken);
      console.log(`Refreshed token: ${oldToken}`);
    } else {
      console.log(`Failed to refresh token: ${oldToken}`);
    }
  }

  await updateTokens(newTokens);
  console.log('Scheduled token refresh completed');
}

module.exports = async (req, res) => {
  try {
    await handleScheduled();
    res.status(200).json({ message: 'Cron job completed successfully' });
  } catch (error) {
    console.error('Error in cron job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};