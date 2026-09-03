const Groq = require('groq-sdk');

async function generateAiSummary(summaryData) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is missing');
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const prompt = `You are an expert AI Finance Controller.
Analyze the following reconciliation summary data and provide a concise, professional 1-paragraph narrative (max 4 sentences) explaining the results to a CFO. Focus on the match rate, the most common exceptions, and overall data health. Do not hallucinate or add any numbers not present in the data. Do not use markdown formatting.

Data:
${JSON.stringify(summaryData, null, 2)}`;

  // Enforce a 10s timeout using AbortController if available, or Promise.race
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-OSS-120b',
      temperature: 0.1,
      max_tokens: 250,
    }, {
      signal: controller.signal
    });

    return chatCompletion.choices[0]?.message?.content?.trim() || 'No summary generated.';
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { generateAiSummary };
