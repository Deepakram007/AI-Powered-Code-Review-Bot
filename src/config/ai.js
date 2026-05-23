const { OpenAI } = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: OPENAI_API_KEY is not defined. AI Code reviews will fail.');
}

const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key',
});

const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

module.exports = {
  openai,
  model,
  // Helper for generic completion
  createChatCompletion: async (messages, responseFormat = null) => {
    const options = {
      model,
      messages,
      temperature: 0.2,
    };

    if (responseFormat) {
      options.response_format = responseFormat;
    }

    const response = await openai.chat.completions.create(options);
    return response.choices[0].message.content;
  }
};
