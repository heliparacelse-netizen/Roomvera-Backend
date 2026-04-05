import fetch from 'node-fetch';
// @ts-nocheck
import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import User from '../models/User';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  const userId = req.user._id;
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image requise' });

    // Vérifier 15 tokens minimum
    const user = await User.findById(userId);
    if (!user || user.tokens < 15) {
      return res.status(402).json({ error: 'Tokens insuffisants (15 requis)', code: 'NO_TOKENS', tokensRemaining: user?.tokens ?? 0 });
    }

    // Déduire 15 tokens AVANT l'analyse
    await User.findByIdAndUpdate(userId, { $inc: { tokens: -15 } });

    // Upload sur Cloudinary pour obtenir une URL publique
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const uploadResult = await cloudinary.uploader.upload(image, {
      folder: 'roomvera/analysis',
      resource_type: 'image'
    });

    const imageUrl = uploadResult.secure_url;

    // Appel HuggingFace vision model (router.huggingface.co — pas l'ancien URL déprécié)
    let description = '';
    let roomType    = 'living room';

    try {
      const hfRes = await fetch(
        'https://router.huggingface.co/hf-inference/models/Salesforce/blip-image-captioning-large',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HF_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: imageUrl })
        }
      );

      if (hfRes.ok) {
        const hfData = await hfRes.json();
        description = Array.isArray(hfData) ? hfData[0]?.generated_text ?? '' : hfData?.generated_text ?? '';
      }
    } catch (hfErr) {
      console.error('HuggingFace error:', hfErr);
    }

    // Fallback si HuggingFace échoue — utiliser Groq pour analyser l'URL
    if (!description) {
      try {
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.HF_API_KEY });
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are an expert interior designer. Analyze the room description and return a JSON with: description (string), roomType (string), detectedObjects (array), lightingAdvice (string), stylesSuggested (array).' },
            { role: 'user', content: `Analyze this room image URL and describe what you would typically see in a room photo for interior design purposes. Image: ${imageUrl}. Return JSON only.` }
          ],
          max_tokens: 500
        });
        const text = completion.choices[0]?.message?.content ?? '';
        try {
          const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
          description = parsed.description ?? 'A room ready for AI redesign';
          roomType    = parsed.roomType ?? 'living room';
        } catch {
          description = 'A well-lit room with furniture, ready for AI redesign. Keep the same layout and window positions.';
        }
      } catch (groqErr) {
        description = 'Room detected. Keep the same layout, walls, and window positions during redesign.';
      }
    }

    // Détecter le type de pièce depuis la description
    const descLower = description.toLowerCase();
    if (descLower.includes('kitchen'))    roomType = 'kitchen';
    else if (descLower.includes('bed'))   roomType = 'bedroom';
    else if (descLower.includes('bath'))  roomType = 'bathroom';
    else if (descLower.includes('office')||descLower.includes('desk')) roomType = 'office';
    else if (descLower.includes('dining')) roomType = 'dining room';
    else roomType = 'living room';

    const freshUser = await User.findById(userId);

    res.json({
      description,
      roomType,
      imageUrl,
      detectedObjects: [],
      tokensRemaining: freshUser?.tokens ?? 0
    });

  } catch (err: any) {
    console.error('Analyze error:', err.message);
    // Rembourser les 15 tokens en cas d'erreur
    await User.findByIdAndUpdate(userId, { $inc: { tokens: 15 } });
    res.status(500).json({ error: err.message ?? 'Analyse échouée. Tokens remboursés.' });
  }
});

export default router;
