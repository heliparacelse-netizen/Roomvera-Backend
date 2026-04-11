const jwt = require('jsonwebtoken');
const User = require('../models/User');
const protect = async (req, res, next) => { let token; if (req.cookies && req.cookies.token) token = req.cookies.token; if (!token) return res.status(401).json({ error: 'Not authorized' }); try { const decoded = jwt.verify(token, process.env.JWT_SECRET); req.user = await User.findById(decoded.id); next(); } catch (error) { return res.status(401).json({ error: 'Token failed' }); } };
module.exports = { protect };
