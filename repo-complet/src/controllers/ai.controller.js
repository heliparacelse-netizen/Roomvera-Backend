const cloudinary = require('../config/cloudinary');
const Project = require('../models/Project');
const { generateImage } = require('../services/ai/replicate.service');
const { createVideo, pollVideo } = require('../services/ai/luma.service');
const { create3D, poll3D } = require('../services/ai/csm.service');
const { chatCompletion } = require('../services/ai/groq.service');
const { imageAnalysis } = require('../services/ai/huggingface.service');
const { buildPromptConfig } = require('../services/ai/prompts');

// --- Helpers ---
const uploadToCloudinary = (buffer, folder = 'roomvera_interiors') =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder }, (err, res) => (err ? reject(err) : resolve(res)))
      .end(buffer);
  });

// Le frontend envoie tout dans un seul champ FormData "payload" (JSON).
const parsePayload = (req) => {
  try { return JSON.parse(req.body.payload || '{}'); }
  catch { return {}; }
};

// --- Coeur generique pour les outils image ---
const COSTS = {
  'add-furniture': 2, 'remove-object': 1, 'declutter': 1, 'style-swap': 1,
  'seasonal': 1, 'materials': 1, 'pool-water': 1, 'enhance': 3,
};

const processImageTool = (action) => async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Aucune image fournie' });
    const cost = COSTS[action] || 1;
    if (req.user.credits < cost)
      return res.status(403).json({ message: 'Credits insuffisants' });

    const payload = parsePayload(req);
    const cRes = await uploadToCloudinary(req.file.buffer);
    const { prompt, promptStrength, negativePrompt } = buildPromptConfig(action, payload);
    const outputUrl = await generateImage(cRes.secure_url, prompt, { promptStrength, negativePrompt });

    req.user.credits -= cost;
    await req.user.save();
    await Project.create({
      user: req.user._id, type: action, prompt,
      inputUrl: cRes.secure_url, outputUrl, creditsCost: cost,
    });

    // Le frontend fait URL.createObjectURL(await res.blob()) :
    // on renvoie donc l'image binaire, pas du JSON.
    const axios = require('axios');
    const img = await axios.get(outputUrl, { responseType: 'arraybuffer' });
    res.set('Content-Type', img.headers['content-type'] || 'image/png');
    res.set('X-Credits-Remaining', String(req.user.credits));
    return res.status(200).send(Buffer.from(img.data, 'binary'));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// --- 8 outils image ---
exports.addFurniture = processImageTool('add-furniture');
exports.removeObject = processImageTool('remove-object');
exports.declutter   = processImageTool('declutter');
exports.styleSwap   = processImageTool('style-swap');
exports.seasonal    = processImageTool('seasonal');
exports.materials   = processImageTool('materials');
exports.poolWater   = processImageTool('pool-water');
exports.enhance     = processImageTool('enhance');

// --- Video : le frontend envoie JSON { imageUrl } et attend { videoUrl } ---
exports.generateVideo = async (req, res) => {
  try {
    if (req.user.credits < 5) return res.status(403).json({ message: 'Credits insuffisants' });
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: 'imageUrl requis' });
    const vId = await createVideo(imageUrl);
    const videoUrl = await pollVideo(vId);
    req.user.credits -= 5;
    await req.user.save();
    await Project.create({
      user: req.user._id, type: 'generate-video',
      inputUrl: imageUrl, outputUrl: videoUrl, creditsCost: 5,
    });
    return res.status(200).json({ videoUrl });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// --- 3D : le frontend envoie JSON { imageUrl } et attend { modelUrl } ---
exports.generate3D = async (req, res) => {
  try {
    if (req.user.credits < 3) return res.status(403).json({ message: 'Credits insuffisants' });
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: 'imageUrl requis' });
    const tId = await create3D(imageUrl);
    const modelUrl = await poll3D(tId);
    req.user.credits -= 3;
    await req.user.save();
    await Project.create({
      user: req.user._id, type: 'generate-3d',
      inputUrl: imageUrl, outputUrl: modelUrl, creditsCost: 3,
    });
    return res.status(200).json({ modelUrl });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// --- Assistant chat ---
exports.chatAssistant = async (req, res) => {
  try {
    if (req.file) {
      const cRes = await uploadToCloudinary(req.file.buffer, 'roomvera_chat');
      const analysis = await imageAnalysis(cRes.secure_url);
      return res.status(200).json({
        reply: `Image analysee : "${analysis}". ${req.body.prompt || 'Comment puis-je vous aider a la redesigner ?'}`,
      });
    }
    const history = req.body.history || [{ role: 'user', content: req.body.prompt }];
    const reply = await chatCompletion(history);
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
