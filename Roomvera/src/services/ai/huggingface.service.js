const axios = require('axios');

// L'API d'inference HF attend les OCTETS bruts de l'image dans le corps,
// pas un champ image_url. On telecharge donc l'image puis on l'envoie en binaire.
const MODEL = process.env.HF_CAPTION_MODEL || 'Salesforce/blip-image-captioning-large';

const imageAnalysis = async (imageUrl) => {
  const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const { data } = await axios.post(
    `https://api-inference.huggingface.co/models/${MODEL}`,
    Buffer.from(imgRes.data, 'binary'),
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
    }
  );
  // Reponse attendue : [{ generated_text: "..." }]
  if (Array.isArray(data) && data[0] && data[0].generated_text) {
    return data[0].generated_text;
  }
  return 'interior scene';
};

module.exports = { imageAnalysis };
