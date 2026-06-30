const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  // Le frontend envoie le token comme ça, le backend DOIT le lire ici :
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Non authentifié' });
  }
  
  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // On attache l'utilisateur complet pour pouvoir accéder aux crédits plus tard
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ message: 'Utilisateur non trouvé' });
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

module.exports = { protect };
