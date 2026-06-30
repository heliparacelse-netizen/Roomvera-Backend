# Roomvera — Backend corrigé (version SANS paiement + meilleur rendu IA)

Tout marche maintenant SANS Stripe. Tu activeras le paiement plus tard.

## Ce qui a changé (résumé)

1. **Branchement frontend/backend réparé** — les 8 outils, vidéo et 3D répondent là où le
   frontend les appelle (avant : 404 silencieux sur chaque clic).
2. **Démarre sans Stripe** — pas besoin de clé de paiement pour lancer le site. La page
   Tarifs affichera "bientôt disponible" si on clique sur un plan payant.
3. **Meilleur rendu IA** — nouveau modèle `adirik/interior-design` qui PRÉSERVE la
   structure de la pièce (murs, fenêtres) et applique le design. ~0,007 $ par image,
   ~7 secondes.
4. **Couleurs + dispositions** — nouveau fichier `prompts.js` avec palettes par style
   (scandinave, industriel, bohème, luxe, moderne), ambiances saisonnières, et traduction
   des positions de meubles en placement décrit.

## Fichiers à remplacer dans ton repo `Roomvera-Backend`

- `src/index.js`
- `src/config/stripe.js`
- `src/controllers/ai.controller.js`
- `src/controllers/auth.controller.js`
- `src/controllers/payment.controller.js`
- `src/routes/ai.routes.js`
- `src/routes/payment.routes.js`
- `src/services/ai/replicate.service.js`
- `src/services/ai/groq.service.js`
- `src/services/ai/huggingface.service.js`
- `src/services/ai/prompts.js`  ← NOUVEAU fichier à créer
- `render.yaml`
- `.env.example`

## Variables d'environnement Render (ce dont tu as besoin MAINTENANT)

Essentielles (à remplir) :
- `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `GROQ_API_KEY` (chat), `HF_TOKEN` (analyse image), `REPLICATE_API_TOKEN` (les 8 outils)

Laisse VIDES pour l'instant (ne pas supprimer) :
- toutes les `STRIPE_*`
- `LUMA_API_KEY` (vidéo) et `CSM_API_KEY` (3D) — si vides, seuls ces 2 outils ne marcheront
  pas, le reste fonctionne.

Optionnelle :
- `REPLICATE_MODEL` — déjà fixée dans le code sur le bon modèle, ne rien mettre.
- `GROQ_MODEL` = `llama-3.3-70b-versatile` (déjà dans render.yaml).

## Côté Vercel (frontend)
- `NEXT_PUBLIC_API_URL` = URL de ton backend Render (ex. `https://roomvera-backend.onrender.com`),
  sans slash final, sans `/api`.

## Ordre conseillé
1. Remplace/ajoute les fichiers ci-dessus, pousse sur GitHub.
2. Vérifie les variables Render (les essentielles surtout).
3. Vérifie `NEXT_PUBLIC_API_URL` sur Vercel.
4. Teste `https://ton-backend.onrender.com/api/health` → doit renvoyer `{"status":"OK"}`.
5. Inscris-toi sur le site, uploade une photo de pièce, lance "Changer de style".

## Régler le rendu (si besoin)
Dans `src/services/ai/prompts.js` :
- `promptStrength` proche de 1 = transforme beaucoup ; proche de 0 = garde l'original.
  (ex. `enhance` = 0.35 pour à peine retoucher ; `style-swap` = 0.85 pour bien changer).
- Modifie les palettes `STYLE_PALETTES` pour ajuster les couleurs de chaque style.
