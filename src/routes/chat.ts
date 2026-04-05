// @ts-nocheck
import { Router } from 'express';
import Groq from 'groq-sdk';
import User from '../models/User';
import ChatSession from '../models/ChatSession';
import { authenticate, requireTokensForChat } from '../middleware/auth';

const router = Router();

// GET /api/chat/sessions — historique des sessions
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user._id })
      .sort({ updatedAt: -1 }).limit(20).select('title lastMessage updatedAt messages');
    res.json({ sessions });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// GET /api/chat/sessions/:id — une session
router.get('/sessions/:id', authenticate, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session introuvable' });
    res.json({ session });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// DELETE /api/chat/sessions/:id
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    await ChatSession.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Erreur' }); }
});

// POST /api/chat — message principal
router.post('/', authenticate, requireTokensForChat, async (req, res) => {
  const userId = req.user._id;
  try {
    const { messages, sessionId, systemContext, analysisDescription } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages[] requis' });

    await User.findByIdAndUpdate(userId, { $inc: { tokens: -15 } });

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      await User.findByIdAndUpdate(userId, { $inc: { tokens: 15 } });
      return res.status(503).json({ reply: 'Service chat non configuré.', error: 'GROQ_API_KEY manquante' });
    }

    const groq = new Groq({ apiKey: groqKey });

    let roomContext = '';
    if (analysisDescription) roomContext = `\n\nThe user has uploaded a room photo. Analysis: ${analysisDescription}`;

    const systemPrompt = `You are Roomvera AI, an expert interior designer assistant. Help users with room redesign, furniture suggestions, style advice, color palettes, and prompt improvement. Be concise, practical, and inspiring. Respond in the same language as the user.${roomContext}${systemContext ? '\n\n' + systemContext : ''}

IMPORTANT: If the user asks you to generate/redesign/create an image of their room, respond with a JSON trigger on the LAST line of your message in this exact format:
__GENERATE__{"style":"modern","roomType":"living","prompt":"user's specific request","reason":"brief explanation"}

Only add this trigger when the user explicitly asks for image generation. Never add it for regular design advice.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10) // garder les 10 derniers messages pour le contexte
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const rawReply = completion.choices[0]?.message?.content ?? 'Erreur de réponse.';

    // Détecter le trigger de génération
    let reply = rawReply;
    let generateTrigger = null;
    const triggerMatch = rawReply.match(/__GENERATE__({.*})/);
    if (triggerMatch) {
      try {
        generateTrigger = JSON.parse(triggerMatch[1]);
        reply = rawReply.replace(/__GENERATE__{.*}/, '').trim();
      } catch { /* ignore parse error */ }
    }

    // Sauvegarder/mettre à jour la session
    const userMsg  = messages[messages.length - 1];
    const lastMsgPreview = userMsg?.content?.slice(0, 80) ?? '';
    const title = messages.length <= 2 ? (userMsg?.content?.slice(0, 50) ?? 'New conversation') : undefined;

    let session;
    if (sessionId) {
      session = await ChatSession.findOneAndUpdate(
        { _id: sessionId, userId },
        {
          $push: {
            messages: [
              { role: 'user', content: userMsg?.content ?? '' },
              { role: 'assistant', content: reply }
            ]
          },
          lastMessage: lastMsgPreview,
          ...(title ? { title } : {})
        },
        { new: true }
      );
    } else {
      session = await ChatSession.create({
        userId,
        title: title ?? 'New conversation',
        lastMessage: lastMsgPreview,
        messages: [
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
          { role: 'assistant', content: reply }
        ]
      });
    }

    const freshUser = await User.findById(userId);

    res.json({
      reply,
      generateTrigger,
      sessionId: session?._id,
      tokensRemaining: freshUser?.tokens ?? 0
    });
  } catch (err: any) {
    console.error('Chat error:', err.message);
    await User.findByIdAndUpdate(userId, { $inc: { tokens: 15 } });
    res.status(500).json({ reply: 'Erreur chat. Tokens remboursés.', error: err.message });
  }
});

export default router;
