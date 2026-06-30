const User = require('../models/User');
const jwt = require('jsonwebtoken');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const getPlanMaxCredits = (plan) => {
  if (plan === 'Basic') return 50;
  if (plan === 'Pro') return 150;
  if (plan === 'Agency') return 100000; // "illimite"
  return 3; // Free
};

// Le frontend lit res.user.credits et res.user.maxCredits (imbriques dans user),
// et res.token. On renvoie donc credits/maxCredits a la fois dans user ET a la
// racine pour etre robuste.
const authResponse = (user, token) => {
  const maxCredits = getPlanMaxCredits(user.plan);
  return {
    user: {
      email: user.email,
      name: user.name,
      plan: user.plan,
      credits: user.credits,
      maxCredits,
    },
    token,
    credits: user.credits,
    maxCredits,
  };
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Champs requis manquants' });
    if (await User.findOne({ email }))
      return res.status(400).json({ message: 'Cet utilisateur existe deja' });

    const user = await User.create({ name, email, password });
    const token = signToken(user._id);
    return res.status(201).json(authResponse(user, token));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Identifiants invalides' });

    const token = signToken(user._id);
    return res.status(200).json(authResponse(user, token));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    // Reponse identique meme si l'email n'existe pas (anti enumeration)
    if (!user) return res.status(200).json({ message: 'Si ce compte existe, un lien a ete envoye' });

    user.resetPasswordToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();

    return res.status(200).json({ message: 'Si ce compte existe, un lien a ete envoye' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
