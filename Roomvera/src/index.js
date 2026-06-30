require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const app = express();
connectDB();

// --- CORS : autorise le(s) frontend(s) Vercel ---
// FRONTEND_URL peut contenir plusieurs origines separees par des virgules.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Autorise les requetes sans origin (curl, health checks) et les origines listees.
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origine non autorisee par CORS'));
  },
  credentials: true,
}));

// --- Webhook Stripe : DOIT recevoir le corps brut, AVANT express.json() ---
// Monte uniquement si Stripe est configure (cles presentes).
if (process.env.STRIPE_SECRET_KEY) {
  app.post(
    '/api/payment/webhook',
    express.raw({ type: 'application/json' }),
    require('./controllers/payment.controller').handleWebhook
  );
}

// --- Parsers pour tout le reste ---
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// --- Routes ---
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/user', require('./routes/user.routes'));
// Les routes IA sont montees a la racine /api pour matcher le frontend
// (ex: POST /api/add-furniture, /api/generate-video, ...).
app.use('/api', require('./routes/ai.routes'));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK' }));
app.get('/', (req, res) => res.status(200).json({ name: 'Roomvera API', status: 'running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
