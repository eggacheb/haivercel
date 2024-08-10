const { handleAudioSpeech } = require('../lib/token-utils');
const apiSelector = require('../lib/api-selector');

module.exports = async (req, res) => {
  try {
    await apiSelector.loadResponseTimes();
    const apiUrl = await apiSelector.selectAPI();
    console.log(`Using API URL for audio speech: ${apiUrl}`);
    await handleAudioSpeech(req, res);
  } catch (error) {
    console.error('Unhandled error in audio-speech:', error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};
