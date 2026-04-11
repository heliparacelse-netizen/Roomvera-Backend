const axios = require('axios');
const cloudinary = require('../../config/cloudinary');
const createVideo = async (imageUrl) => {
    const { data } = await axios.post('https://api.lumalabs.ai/dream-machine/v1/generations', { image_url: imageUrl, prompt: "Slow cinematic pan" }, { headers: { 'Authorization': `Bearer ${process.env.LUMA_API_KEY}`, 'Content-Type': 'application/json' } });
    return data.id;
};
const pollVideo = async (generationId) => {
    let status = 'pending', videoUrl = null;
    while (status !== 'completed' && status !== 'failed') {
        await new Promise(r => setTimeout(r, 5000));
        const { data } = await axios.get(`https://api.lumalabs.ai/dream-machine/v1/generations/${generationId}`, { headers: { 'Authorization': `Bearer ${process.env.LUMA_API_KEY}` } });
        status = data.state;
        if (status === 'completed') videoUrl = data.assets.video;
        else if (status === 'failed') throw new Error('Luma failed');
    }
    const res = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(res.data, 'binary');
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: 'video', folder: 'roomvera_videos' }, (err, result) => err ? reject(err) : resolve(result.secure_url)).end(buffer);
    });
};
module.exports = { createVideo, pollVideo };
