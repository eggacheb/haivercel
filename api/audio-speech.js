const { handleAudioSpeech } = require('../lib/token-utils');
const apiSelector = require('../lib/api-selector');

module.exports = async (req, res) => {
  await apiSelector.loadResponseTimes();
  await handleAudioSpeech(req, res);
};