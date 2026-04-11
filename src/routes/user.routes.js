const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getCredits, getProjects } = require('../controllers/user.controller');

router.get('/credits', protect, getCredits);
router.get('/projects', protect, getProjects);

module.exports = router;
