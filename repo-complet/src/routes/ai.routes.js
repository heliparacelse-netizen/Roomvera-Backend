const router = require('express').Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const c = require('../controllers/ai.controller');

// Le frontend appelle POST ${API}/api/<toolId> directement.
// Ces routes sont montees a la racine /api (voir index.js), donc les chemins
// ci-dessous correspondent exactement aux toolId du frontend (lib/data.ts).

// --- 8 outils image (multipart, champ "image") ---
router.post('/add-furniture', protect, upload.single('image'), c.addFurniture);
router.post('/remove-object', protect, upload.single('image'), c.removeObject);
router.post('/declutter', protect, upload.single('image'), c.declutter);
router.post('/style-swap', protect, upload.single('image'), c.styleSwap);
router.post('/seasonal', protect, upload.single('image'), c.seasonal);
router.post('/materials', protect, upload.single('image'), c.materials);
router.post('/pool-water', protect, upload.single('image'), c.poolWater);
router.post('/enhance', protect, upload.single('image'), c.enhance);

// --- Video & 3D : le frontend envoie du JSON { imageUrl } ---
router.post('/generate-video', protect, c.generateVideo);
router.post('/generate-3d', protect, c.generate3D);

// --- Assistant chat (optionnel) ---
router.post('/chat', protect, upload.single('image'), c.chatAssistant);

module.exports = router;
