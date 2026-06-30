const Replicate = require('replicate');
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Modele specialise interieur : preserve la structure de la piece (murs, fenetres)
// via segmentation + MLSD ControlNet, et applique le design decrit dans le prompt.
// https://replicate.com/adirik/interior-design
const MODEL = process.env.REPLICATE_MODEL ||
  'adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38';

// prompt_strength : 0 = garde l'image quasi intacte, 1 = transforme totalement.
// On l'ajuste par outil pour preserver plus ou moins la piece d'origine.
const generateImage = async (imageUrl, prompt, opts = {}) => {
  const input = {
    image: imageUrl,
    prompt,
    negative_prompt: opts.negativePrompt ||
      'blurry, deformed, distorted, low quality, unrealistic, bad proportions, ' +
      'cluttered, messy, warped furniture, extra walls, watermark, text',
    num_inference_steps: opts.steps || 30,
    guidance_scale: opts.guidanceScale || 9,
    prompt_strength: opts.promptStrength ?? 0.8,
  };
  const output = await replicate.run(MODEL, { input });
  // Le modele renvoie une URL (string) ou un tableau selon la version.
  return Array.isArray(output) ? output[0] : output;
};

module.exports = { generateImage };
