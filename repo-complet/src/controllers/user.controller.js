const User = require('../models/User');
const Project = require('../models/Project');

const getPlanMaxCredits = (plan) => {
  if (plan === 'Basic') return 50;
  if (plan === 'Pro') return 200;
  if (plan === 'Agency') return 1000;
  return 3; // Free
};

exports.getCredits = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ 
      credits: user.credits, 
      max: getPlanMaxCredits(user.plan) 
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ user: req.user._id }).sort({ createdAt: -1 });
    // Format exact attendu par le frontend
    const formatted = projects.map(p => ({
      id: p._id,
      tool: p.type,
      src: p.inputUrl,
      resultSrc: p.outputUrl,
      date: p.createdAt
    }));
    res.status(200).json(formatted);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
