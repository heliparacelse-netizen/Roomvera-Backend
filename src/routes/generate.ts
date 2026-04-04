// @ts-nocheck
import { Router } from 'express';
import FormData from 'form-data';
import { v2 as cloudinary } from 'cloudinary';
import Generation from '../models/Generation';
import User from '../models/User';
import { authenticate, requireTokensForGenerate } from '../middleware/auth';

const router = Router();

const STYLE_PROMPTS = {
  modern:       'modern interior, clean lines, neutral palette, open space, contemporary furniture',
  minimal:      'minimalist interior, white walls, essential furniture only, lots of natural light',
  luxury:       'luxury interior design, marble surfaces, gold accents, velvet fabrics, high-end furniture',
  scandinavian: 'Scandinavian interior, light wood, white tones, cozy hygge atmosphere',
  industrial:   'industrial loft, exposed brick, metal pipes, dark palette, urban aesthetic',
  classic:      'classic interior, symmetry, rich wood, traditional furniture, elegant details',
  japandi:      'Japandi style, wabi-sabi, natural materials, muted earth tones, zen minimalism',
  bohemian:     'bohemian interior, eclectic mix, colorful textiles, plants, warm earthy tones'
};

const ROOM_PROMPTS = {
  living:   'living room with sofa, coffee table, rug, ambient lighting',
  bedroom:  'bedroom with king bed, nightstands, soft lighting',
  kitchen:  'kitchen with countertops, cabinets, island, modern appliances',
  bathroom: 'bathroom with freestanding tub, walk-in shower, marble vanity',
  office:   'home office with desk, ergonomic chair, shelving',
  dining:   'dining room with table, chairs, statement chandelier'
};

router.post('/', authenticate, requireTokensForGenerate, async (req, res) => {
  const userId = req.user._id;
  let genDoc = null;

  try {
    const { image, style = 'modern', roomType = 'living', prompt = '' } = req.body;

    // Déduire 25 tokens AVANT génération
    await User.findByIdAndUpdate(userId, { $inc: { tokens: -25 } });

    const structureText = 'keep the exact same room layout, same window positions, same wall structure, only change decoration and furniture style';
    const lightingText  = 'beautiful natural lighting, warm ambient glow, professional interior photography';
    const finalPrompt   = [prompt, STYLE_PROMPTS[style] || STYLE_PROMPTS.modern, ROOM_PROMPTS[roomType] || ROOM_PROMPTS.living, structureText, lightingText].filter(Boolean).join(', ');
    const negativePrompt = 'low quality, blurry, ugly, distorted, people, faces, text, watermark, cartoon';

    genDoc = await Generation.create({ userId, style, roomType, prompt: finalPrompt, status: 'pending' });

    const stabilityKey = process.env.STABILITY_API_KEY;
    if (!stabilityKey) throw new Error('STABILITY_API_KEY manquante');

    const formData = new FormData();
    formData.append('prompt', finalPrompt);
    formData.append('negative_prompt', negativePrompt);
    formData.append('output_format', 'png');

    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer  = Buffer.from(base64Data, 'base64');
      formData.append('image', imgBuffer, { filename: 'room.png', contentType: 'image/png' });
      formData.append('mode', 'image-to-image');
      formData.append('strength', '0.8');
    }

    const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stabilityKey}`, Accept: 'image/*', ...formData.getHeaders() },
      body: formData.getBuffer()
    });

    if (!stabilityRes.ok) {
      const errText = await stabilityRes.text();
      throw new Error(`Stability AI ${stabilityRes.status}: ${errText}`);
    }

    const imgBuffer = Buffer.from(await stabilityRes.arrayBuffer());
    const base64Image = `data:image/png;base64,${imgBuffer.toString('base64')}`;

    // Config Cloudinary DANS le handler
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const freshUser = await User.findById(userId);
    const userPlan  = freshUser?.plan ?? 'free';

    const uploadOptions: any = {
      folder:    'roomvera/generated',
      public_id: `gen_${genDoc._id}`,
      overwrite: true
    };

    // ── WATERMARK plan gratuit ──────────────────────────────
    if (userPlan === 'free') {
      uploadOptions.transformation = [
        {
          overlay: {
            font_family: 'Arial',
            font_size:   22,
            font_weight: 'bold',
            text:        'Roomvera%20AI'
          },
          gravity:  'south_east',
          x:        15,
          y:        15,
          opacity:  35,
          color:    'white'
        }
      ];
    }

    const uploadResult = await cloudinary.uploader.upload(base64Image, uploadOptions);

    await Generation.findByIdAndUpdate(genDoc._id, { outputImageUrl: uploadResult.secure_url, status: 'done' });

    const updatedUser = await User.findById(userId);

    res.json({
      generationId:    genDoc._id,
      imageUrl:        uploadResult.secure_url,
      status:          'done',
      tokensUsed:      25,
      tokensRemaining: updatedUser?.tokens ?? 0,
      watermarked:     userPlan === 'free'
    });

  } catch (err: any) {
    console.error('Generation error:', err.message);
    // Rembourser les 25 tokens
    await User.findByIdAndUpdate(userId, { $inc: { tokens: 25 } });
    if (genDoc) await Generation.findByIdAndUpdate(genDoc._id, { status: 'failed' });
    res.status(500).json({ error: err.message ?? 'Génération échouée. Tokens remboursés.' });
  }
});

router.get('/status/:id', authenticate, async (req, res) => {
  try {
    const gen = await Generation.findOne({ _id: req.params.id, userId: req.user._id });
    if (!gen) return res.status(404).json({ error: 'Introuvable' });
    res.json({ status: gen.status, imageUrl: gen.outputImageUrl });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.get('/download/:id', authenticate, async (req, res) => {
  try {
    const gen = await Generation.findOne({ _id: req.params.id, userId: req.user._id });
    if (!gen || !gen.outputImageUrl) return res.status(404).json({ error: 'Image introuvable' });
    res.redirect(gen.outputImageUrl);
  } catch { res.status(500).json({ error: 'Téléchargement échoué' }); }
});

export default router;
