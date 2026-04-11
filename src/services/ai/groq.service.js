const axios = require('axios');
const chatCompletion = async (messages) => { const { data } = await axios.post('https://api.groq.com/openai/v1/chat/completions', { model: "llama3-70b-8192", messages: [{ role: "system", content: "You are an expert interior design assistant." }, ...messages] }, { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }); return data.choices[0].message.content; };
module.exports = { chatCompletion };
