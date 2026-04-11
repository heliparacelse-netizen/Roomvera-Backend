const axios = require('axios');
const imageAnalysis = async (imageUrl) => {
    const { data } = await axios.post("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large", { image_url: imageUrl }, { headers: { 'Authorization': `Bearer ${process.env.HF_TOKEN}` } });
    return data[0].generated_text;
};
module.exports = { imageAnalysis };
