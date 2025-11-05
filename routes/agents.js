import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// POST /api/agents - Admin only
router.post('/', auth, adminOnly, [
  body('agentName').notEmpty(),
  body('agentId').notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('mobile').notEmpty(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { agentName, agentId, email, mobile, password } = req.body;
    const user = new User({ agentName, agentId, email, mobile, password, role: 'agent' });
    await user.save();
    res.status(201).json({ message: 'Agent created', user: { id: user._id, agentName, agentId, email, mobile } });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Agent ID or email already exists' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// GET /api/agents - Admin only
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' }).select('-password');
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
