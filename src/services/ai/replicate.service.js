const Replicate = require('replicate');
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const generateImage = async (imageUrl, prompt) => {
    const output = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc", {
        input: { image: imageUrl, prompt: `Interior design, photorealistic, 8k, high quality, ${prompt}`, num_outputs: 1, guidance_scale: 7.5, prompt_strength: 0.8 }
    });
    return output[0];
};
module.exports = { generateImage };
