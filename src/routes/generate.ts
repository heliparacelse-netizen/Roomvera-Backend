import { Router, Response } from 'express';
import FormData from 'form-data';
import { v2 as cloudinary } from 'cloudinary';
import Generation from '../models/Generation';
import User from '../models/User';
import { authenticate, requireTokensForGenerate, AuthRequest } from '../middleware/auth';

const router = Router();

// Dictionnaire de styles
const stylePrompts: Record<string, string> = {
  modern:       'modern minimalist style, clean lines, neutral colors, contemporary furniture',
  scandinavian: 'Scandinavian style, light wood, white walls, cozy hygge atmosphere, minimal decor',
  industrial:   'industrial loft style, exposed brick, metal accents, dark tones, urban aesthetic',
  bohemian:     'bohemian style, colorful textiles, plants, eclectic mix, warm earthy tones',
  luxury:       'luxury interior design, marble surfaces, gold accents, rich velvet fabrics, high-end furniture',
  japanese:     'Japanese Japandi minimalist style, zen atmosphere, natural wood, wabi-sabi aesthetics',
  coastal:      'coastal beach house style, soft blues, whites, natural rattan textures, bright and airy',
  rustic:       'rustic farmhouse style, reclaimed wood, warm earth tones, vintage elements, cozy atmosphere'
};

// Dictionnaire de pièces
const roomPrompts: Record<string, string> = {
  living:   'living room with comfortable sofa and seating area',
  bedroom:  'bedroom with bed, nightstands and sleeping area',
  kitchen:  'kitchen with countertops, cabinets and cooking area',
  bathroom: 'bathroom with bathtub or shower, vanity and fixtures',
  office:   'home office with desk, chair and workspace',
  dining:   'dining room with dining table and chairs'
};

// POST /api/generate
router.post(
  '/',
  authenticate,
  requireTokensForGenerate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user._id;
    let generationDoc: any = null;

    try {
      const { image, style = 'modern', roomType = 'living', prompt = '' } = req.body;

      // ── 1. Déduire 25 tokens AVANT la génération ──
      await User.findByIdAndUpdate(userId, { $inc: { tokens: -25 } });

      // ── 2. Construire le prompt final ──
      const structurePreservation =
        'keep the exact same room layout, same window positions, same wall structure, only change decoration and furniture style';
      const lightingEnhancement =
        'professional interior photography lighting, bright and well-lit, high resolution';

      const finalPrompt = [
        prompt,
        stylePrompts[style] ?? stylePrompts.modern,
        roomPrompts[roomType] ?? roomPrompts.living,
        structurePreservation,
        lightingEnhancement
      ]
        .filter(Boolean)
        .join(', ');

      const negativePrompt =
        'low quality, blurry, ugly, distorted, people, faces, text, watermark, cartoon, drawing';

      // ── 3. Créer l'entrée en base (status: pending) ──
      generationDoc = await Generation.create({
        userId,
        style,
        roomType,
        prompt: finalPrompt,
        status: 'pending'
      });

      // ── 4. Vérifier la clé Stability AI ──
      const stabilityKey = process.env.STABILITY_API_KEY;
      if (!stabilityKey) throw new Error('STABILITY_API_KEY non configurée sur Render');

      // ── 5. Construire le FormData avec le package NPM form-data ──
      // IMPORTANT : utiliser le package npm "form-data", PAS le FormData natif du navigateur
      // Utiliser getBuffer() + getHeaders() pour éviter l'erreur "no boundary string"
      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      formData.append('negative_prompt', negativePrompt);
      formData.append('output_format', 'png');

      if (image) {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        formData.append('image', imageBuffer, {
          filename: 'room.png',
          contentType: 'image/png'
        });
        formData.append('mode', 'image-to-image');
        formData.append('strength', '0.8');
      }

      // ── 6. Appel à Stability AI SD3 ──
      const stabilityRes = await fetch(
        'https://api.stability.ai/v2beta/stable-image/generate/sd3',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stabilityKey}`,
            Accept: 'image/*',
            // Spread des headers form-data pour inclure le Content-Type avec boundary
            ...(formData.getHeaders() as Record<string, string>)
          },
          // Cast Buffer as unknown as BodyInit pour corriger l'erreur TypeScript
          body: formData.getBuffer() as unknown as BodyInit
        }
      );

      if (!stabilityRes.ok) {
        const errText = await stabilityRes.text();
        throw new Error(`Stability AI ${stabilityRes.status}: ${errText}`);
      }

      const imgArrayBuffer = await stabilityRes.arrayBuffer();
      const imgBuffer = Buffer.from(imgArrayBuffer);
      const base64Image = `data:image/png;base64,${imgBuffer.toString('base64')}`;

      // ── 7. Upload Cloudinary ──
      // CRITIQUE : appeler cloudinary.config() ICI (dans le handler) et non au niveau module
      // pour s'assurer que les variables d'env sont bien chargées par dotenv
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // ID cloud (ex: dvsxn7bzk) PAS le nom
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      // Récupérer le plan à jour
      const freshUser = await User.findById(userId);
      const userPlan = freshUser?.plan ?? 'free';

      const uploadOptions: Record<string, any> = {
        folder:     'roomvera/generated',
        public_id:  `gen_${generationDoc._id}`,
        overwrite:  true
      };

      // Filigrane uniquement pour le plan gratuit
      if (userPlan === 'free') {
        uploadOptions.transformation = [
          {
            overlay: { font_family: 'Arial', font_size: 18, text: 'Roomvera AI' },
            gravity: 'south_east',
            x:       10,
            y:       10,
            opacity: 35,
            color:   'white'
          }
        ];
      }

      const uploadResult = await cloudinary.uploader.upload(base64Image, uploadOptions);

      // ── 8. Mettre à jour la génération en base ──
      await Generation.findByIdAndUpdate(generationDoc._id, {
        outputImageUrl: uploadResult.secure_url,
        status: 'done'
      });

      res.json({
        generationId:    generationDoc._id,
        imageUrl:        uploadResult.secure_url,
        status:          'done',
        tokensUsed:      25,
        tokensRemaining: freshUser?.tokens ?? 0
      });
    } catch (err: any) {
      console.error('Generation error:', err.message);

      // ── Rembourser les 25 tokens en cas d'échec ──
      await User.findByIdAndUpdate(userId, { $inc: { tokens: 25 } });

      if (generationDoc) {
        await Generation.findByIdAndUpdate(generationDoc._id, { status: 'failed' });
      }

      res.status(500).json({
        error: err.message ?? 'Génération échouée. Tokens remboursés.'
      });
    }
  }
);

// GET /api/generate/status/:id
router.get('/status/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gen = await Generation.findOne({ _id: req.params.id, userId: req.user._id });
    if (!gen) {
      res.status(404).json({ error: 'Génération introuvable' });
      return;
    }
    res.json({ status: gen.status, imageUrl: gen.outputImageUrl });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/generate/download/:id
router.get('/download/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gen = await Generation.findOne({ _id: req.params.id, userId: req.user._id });
    if (!gen || !gen.outputImageUrl) {
      res.status(404).json({ error: 'Image introuvable' });
      return;
    }
    res.redirect(gen.outputImageUrl);
  } catch {
    res.status(500).json({ error: 'Téléchargement échoué' });
  }
});

export default router;
