// @ts-nocheck
import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import User from '../models/User';
import { authenticate } from '../middleware/auth';
import Groq from 'groq-sdk';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  const userId = req.user._id;
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image requise' });

    const user = await User.findById(userId);
    if (!user || user.tokens < 15) {
      return res.status(402).json({
        error: 'Tokens insuffisants (15 requis)',
        code: 'NO_TOKENS',
        tokensRemaining: user?.tokens ?? 0
      });
    }

    await User.findByIdAndUpdate(userId, { $inc: { tokens: -15 } });

    // Groq Vision — llama-4-scout voit réellement les images (base64)
    // Même clé GROQ_API_KEY déjà configurée sur Render, rien à ajouter
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const mimeType   = image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    let description  = '';
    let roomType     = 'living room';
    let stylesSuggested: string[] = [];
    let lightingAdvice = '';
    let furnitureSuggestions: string[] = [];

    try {
      const completion = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Data}` }
              },
              {
                type: 'text',
                text: `You are an expert interior designer. Analyze this room photo and return ONLY valid JSON (no markdown, no explanation):
{
  "description": "detailed 2-3 sentence description of the room including layout, furniture, lighting, colors, windows position",
  "roomType": "living room|bedroom|kitchen|bathroom|office|dining room",
  "stylesSuggested": ["style1","style2","style3"],
  "lightingAdvice": "one sentence about lighting",
  "furnitureSuggestions": ["suggestion1","suggestion2","suggestion3"],
  "colorPalette": "describe current colors in 1 sentence"
}`
              }
            ]
          }
        ],
        max_tokens: 600,
        temperature: 0.3
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      description         = parsed.description        ?? '';
      roomType            = parsed.roomType           ?? 'living room';
      stylesSuggested     = parsed.stylesSuggested    ?? [];
      lightingAdvice      = parsed.lightingAdvice     ?? '';
      furnitureSuggestions= parsed.furnitureSuggestions ?? [];

    } catch (visionErr) {
      console.error('Groq vision error:', visionErr);
      // Fallback si le modèle vision échoue
      description  = 'A room with furniture and natural light, ready for AI redesign. Keep the same layout and window positions.';
      roomType     = 'living room';
      stylesSuggested = ['modern','scandinavian','japandi'];
    }

    const freshUser = await User.findById(userId);

    res.json({
      description,
      roomType,
      stylesSuggested,
      lightingAdvice,
      furnitureSuggestions,
      tokensRemaining: freshUser?.tokens ?? 0
    });

  } catch (err: any) {
    console.error('Analyze error:', err.message);
    await User.findByIdAndUpdate(userId, { $inc: { tokens: 15 } });
    res.status(500).json({ error: err.message ?? 'Analyse échouée. Tokens remboursés.' });
  }
});

export default router;
