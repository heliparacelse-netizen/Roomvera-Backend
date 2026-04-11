const User = require('../models/User');
const jwt = require('jsonwebtoken');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const getPlanMaxCredits = (plan) => {
  if (plan === 'Basic') return 50;
  if (plan === 'Pro') return 200;
  if (plan === 'Agency') return 1000;
  return 3; // Free
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'User exists' });
    
    const user = await User.create({ name, email, password });
    const token = signToken(user._id);
    
    // Format exact attendu par le frontend
    res.status(201).json({
      user: {
        email: user.email,
        name: user.name,
        plan: user.plan
      },
      token,
      credits: user.credits,
      maxCredits: getPlanMaxCredits(user.plan)
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    
    const token = signToken(user._id);
    
    // Format exact attendu par le frontend
    res.status(200).json({
      user: {
        email: user.email,
        name: user.name,
        plan: user.plan
      },
      token,
      credits: user.credits,
      maxCredits: getPlanMaxCredits(user.plan)
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.resetPasswordToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();
    
    res.status(200).json({ message: 'Reset token generated' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
