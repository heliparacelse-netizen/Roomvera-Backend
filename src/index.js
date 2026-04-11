require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const app = express();
connectDB();

// CORS strict pour le frontend Vercel
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // L'URL exacte de ton site Vercel
  credentials: true // INDISPENSABLE pour les cookies
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/ai', require('./routes/ai.routes'));
app.use('/api/user', require('./routes/user.routes'));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
