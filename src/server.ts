import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Charger les variables d'environnement EN PREMIER
dotenv.config();

const app = express();

// ── CORS : origin * pour éviter les problèmes avec Vercel preview URLs ──
app.use(cors({ origin: '*' }));

// ── Body parsers ──
// Le webhook Stripe nécessite le raw body → on l'exclut du JSON parser
app.use((req: Request, res: Response, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json({ limit: '25mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ── Routes ──
import authRoutes       from './routes/auth';
import generateRoutes   from './routes/generate';
import chatRoutes       from './routes/chat';
import tokenRoutes      from './routes/tokens';
import projectRoutes    from './routes/projects';
import generationRoutes from './routes/generations';
import stripeRoutes     from './routes/stripe';

// Health check (ping Render pour le réveiller)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Roomvera Backend', timestamp: new Date().toISOString() });
});

app.use('/api/auth',        authRoutes);
app.use('/api/generate',    generateRoutes);
app.use('/api/chat',        chatRoutes);
app.use('/api/tokens',      tokenRoutes);
app.use('/api/projects',    projectRoutes);
app.use('/api/generations', generationRoutes);
app.use('/api/stripe',      stripeRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ── MongoDB ──
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERREUR : MONGODB_URI non défini dans les variables d\'environnement');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// ── Démarrage ──
const PORT = parseInt(process.env.PORT ?? '5000', 10);
app.listen(PORT, () => {
  console.log(`🚀 Roomvera backend running on port ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
});

export default app;
