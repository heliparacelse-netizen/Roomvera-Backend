# Roomvera Backend

API Node.js + Express + TypeScript pour Roomvera AI.

## Déploiement sur Render

1. Créer un nouveau Web Service sur render.com
2. Connecter ce repo GitHub
3. Build command : `npm install && npm run build`
4. Start command : `npm start`
5. Ajouter les variables d'environnement (voir .env.example)

## ⚠️ Points critiques

- **MongoDB Atlas** : Network Access doit autoriser `0.0.0.0/0` pour que Render puisse se connecter
- **CLOUDINARY_CLOUD_NAME** : mettre l'ID cloud (ex: `dvsxn7bzk`), PAS le nom de l'application
- **FRONTEND_URL** : PAS de slash final (ex: `https://roomvera.vercel.app`)
- **Render free tier** : dort après 15 min d'inactivité — la 1ère requête prend 30-60s
- Toujours pinger `/health` avant de tester

## Variables d'environnement Render

Voir `.env.example` pour la liste complète.

## Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /health | Non | Health check |
| POST | /api/auth/register | Non | Inscription (75 tokens offerts) |
| POST | /api/auth/login | Non | Connexion |
| GET | /api/auth/me | JWT | Infos utilisateur |
| GET | /api/tokens | JWT | Tokens & plan |
| POST | /api/tokens/buy | JWT | Acheter des tokens |
| POST | /api/generate | JWT+25t | Générer un redesign |
| GET | /api/generate/status/:id | JWT | Statut génération |
| GET | /api/generate/download/:id | JWT | Télécharger |
| POST | /api/chat | JWT+15t | Chat IA |
| GET | /api/generations | JWT | Historique |
| DELETE | /api/generations/:id | JWT | Supprimer |
| GET | /api/projects | JWT | Projets |
| DELETE | /api/projects/:id | JWT | Supprimer projet |
| POST | /api/stripe/checkout | JWT | Abonnement Stripe |
| POST | /api/stripe/webhook | Stripe | Webhook Stripe |
