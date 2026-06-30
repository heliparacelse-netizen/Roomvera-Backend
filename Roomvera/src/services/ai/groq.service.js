const axios = require('axios');

// llama3-70b-8192 est deprecie chez Groq. On utilise le modele actuel.
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const chatCompletion = async (messages) => {
  const { data } = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are an expert interior design assistant. Answer in the user language.' },
        ...messages,
      ],
    },
    { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
  );
  return data.choices[0].message.content;
};

module.exports = { chatCompletion };
