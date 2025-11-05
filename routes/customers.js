const express = require('express');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const { auth, adminOnly, agentAccess } = require('../middleware/auth');

const router = express.Router();

// Helper to check access
const checkCustomerAccess = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    if (req.user.role !== 'admin' && customer.assignedAgentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    req.customer = customer;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/customers
router.post('/', auth, [
  body('customerName').notEmpty(),
  body('mobileNumbers').isArray(),
  body('emails').isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/customers - with pagination and filters
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, pinCode, agentId } = req.query;
    let query = {};

    if (req.user.role === 'agent') {
      query.assignedAgentId = req.user._id;
    }

    if (pinCode) query.pinCode = pinCode;
    if (agentId && req.user.role === 'admin') query.assignedAgentId = agentId;

    const customers = await Customer.find(query)
      .populate('assignedAgentId', 'agentName')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Customer.countDocuments(query);
    res.json({
      customers,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/customers/:id
router.get('/:id', auth, checkCustomerAccess, async (req, res) => {
  res.json(req.customer);
});

// PUT /api/customers/:id
router.put('/:id', auth, checkCustomerAccess, [
  body('customerName').optional().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    Object.assign(req.customer, req.body);
    await req.customer.save();
    res.json(req.customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', auth, checkCustomerAccess, async (req, res) => {
  try {
    await req.customer.remove();
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/customers/:id/assign - Admin only
router.post('/:id/assign', auth, adminOnly, [
  body('agentId').isMongoId(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    customer.assignedAgentId = req.body.agentId;
    await customer.save();
    res.json({ message: 'Customer assigned', customer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
