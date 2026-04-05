// @ts-nocheck
import { Router } from 'express';
import FormData from 'form-data';
import { v2 as cloudinary } from 'cloudinary';
import Generation from '../models/Generation';
import User from '../models/User';
import { authenticate, requireTokensForGenerate } from '../middleware/auth';

const router = Router();

const STYLE_PROMPTS: Record<string,string> = {
  modern:       'modern interior design, clean lines, neutral palette, open space, contemporary furniture',
  minimal:      'minimalist interior, white walls, essential furniture only, abundant natural light, negative space',
  luxury:       'luxury interior design, marble surfaces, gold accents, velvet fabrics, high-end designer furniture, opulent atmosphere',
  scandinavian: 'Scandinavian interior design, light natural wood, white tones, cozy hygge atmosphere, functional simplicity',
  industrial:   'industrial loft design, exposed brick walls, metal pipes, dark palette, reclaimed wood, urban aesthetic',
  classic:      'classic traditional interior, symmetry, rich dark wood, ornate furniture, elegant architectural details',
  japandi:      'Japandi style, wabi-sabi philosophy, natural materials, muted earth tones, zen minimalism, harmony',
  bohemian:     'bohemian eclectic interior, colorful textiles, layered rugs, plants, warm earthy tones, artistic decor'
};

const ROOM_PROMPTS: Record<string,string> = {
  living:   'living room with comfortable sofa, coffee table, area rug, ambient lighting, decorative accessories',
  bedroom:  'bedroom with king bed, matching nightstands, soft warm lighting, window treatments, cozy atmosphere',
  kitchen:  'kitchen with countertops, upper and lower cabinets, kitchen island, modern appliances, organized layout',
  bathroom: 'bathroom with freestanding bathtub, walk-in shower, marble vanity, elegant fixtures, spa atmosphere',
  office:   'home office with ergonomic desk setup, built-in bookshelves, good task lighting, professional atmosphere',
  dining:   'dining room with dining table for 6, upholstered chairs, statement chandelier, sideboard'
};

router.post('/', authenticate, requireTokensForGenerate, async (req, res) => {
  const userId = req.user._id;
  let genDoc = null;

  try {
    const {
      image,
      style       = 'modern',
      roomType    = 'living',
      prompt      = '',
      preserve    = true,
      preserveFurniture = false,
      enhanceLighting   = true,
      strength    = 0.8
    } = req.body;

    await User.findByIdAndUpdate(userId, { $inc: { tokens: -25 } });

    // Construire le prompt selon les options
    const parts: string[] = [];
    if (prompt) parts.push(prompt);
    parts.push(STYLE_PROMPTS[style] ?? STYLE_PROMPTS.modern);
    parts.push(ROOM_PROMPTS[roomType] ?? ROOM_PROMPTS.living);

    if (preserve && preserveFurniture) {
      // Conserver la pièce ET les meubles, juste améliorer
      parts.push('keep ALL existing furniture in the same positions, keep the exact same room layout, same walls, same windows, same floor — only improve styling, add decorative accessories, improve color coordination and lighting');
    } else if (preserve && !preserveFurniture) {
      // Conserver la structure mais changer les meubles
      parts.push('keep the exact same room layout, same window positions, same wall structure, same floor material, same ceiling — replace and upgrade the furniture and decoration with the chosen style');
    } else if (!preserve && preserveFurniture) {
      // Garder les meubles mais changer l'environnement
      parts.push('keep all existing furniture pieces — change wall colors, flooring, lighting, and decorative accessories to match the new style while keeping furniture placement');
    } else {
      // Redesign complet créatif
      parts.push('completely reimagine this space with creative freedom — new layout possibilities, new furniture arrangement, bold design choices');
    }

    if (enhanceLighting) {
      parts.push('beautiful natural lighting, warm ambient glow, professional interior photography lighting');
    }

    parts.push('photorealistic interior design render, 8K quality, no people, no text');

    const finalPrompt = parts.filter(Boolean).join(', ');
    const negativePrompt = 'low quality, blurry, ugly, distorted, deformed, people, faces, hands, text, watermark, cartoon, drawing, sketch, painting';

    genDoc = await Generation.create({ userId, style, roomType, prompt: finalPrompt, status: 'pending' });

    const stabilityKey = process.env.STABILITY_API_KEY;
    if (!stabilityKey) throw new Error('STABILITY_API_KEY manquante sur Render');

    const formData = new FormData();
    formData.append('prompt', finalPrompt);
    formData.append('negative_prompt', negativePrompt);
    formData.append('output_format', 'png');

    // Ajuster la force selon les options de préservation
    const genStrength = preserve || preserveFurniture ? 0.75 : parseFloat(String(strength)) || 0.8;

    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer  = Buffer.from(base64Data, 'base64');
      formData.append('image', imgBuffer, { filename: 'room.png', contentType: 'image/png' });
      formData.append('mode', 'image-to-image');
      formData.append('strength', String(genStrength));
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

    const imgBuffer  = Buffer.from(await stabilityRes.arrayBuffer());
    const base64Image = `data:image/png;base64,${imgBuffer.toString('base64')}`;

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

    // Watermark plan gratuit
    if (userPlan === 'free') {
      uploadOptions.transformation = [{
        overlay: { font_family: 'Arial', font_size: 22, font_weight: 'bold', text: 'Roomvera%20AI' },
        gravity: 'south_east', x: 15, y: 15, opacity: 35, color: 'white'
      }];
    }

    const uploadResult = await cloudinary.uploader.upload(base64Image, uploadOptions);

    await Generation.findByIdAndUpdate(genDoc._id, {
      outputImageUrl: uploadResult.secure_url,
      inputImageUrl:  image ? 'uploaded' : '',
      status: 'done'
    });

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
