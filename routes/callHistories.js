import express from 'express';
import { body, validationResult } from 'express-validator';
import CallHistory from '../models/CallHistory.js';
import Customer from '../models/Customer.js';
import { auth,  } from '../middleware/auth.js';
import moment from 'moment/moment.js';

const router = express.Router();

// POST /api/call-histories
router.post('/', auth, [
  body('customerId').isMongoId(),
  body('interested').isBoolean(),
  body('disposition').optional().isString(),
  body('nextCallDateTime').optional().isISO8601(),
  body('attended').isBoolean(),
  body('notes').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if agent has access to customer
    const customer = await Customer.findById(req.body.customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    if (req.user.role !== 'admin' && customer.assignedAgentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const callHistory = new CallHistory({
      ...req.body,
      agentId: req.user._id,
    });
    await callHistory.save();
    res.status(201).json(callHistory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/call-histories?customerId=...
router.get('/', auth, async (req, res) => {
  try {
    const { customerId } = req.query;
    let query = {};

    if (customerId) {
      // Check access to customer
      const customer = await Customer.findById(customerId);
      if (!customer) return res.status(404).json({ message: 'Customer not found' });
      if (req.user.role !== 'admin' && customer.assignedAgentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      query.customerId = customerId;
    } else {
      // If no customerId, only show agent's own call histories
      query.agentId = req.user._id;
    }

    const callHistories = await CallHistory.find(query)
      .populate('customerId', 'customerName')
      .populate('agentId', 'agentName')
      .sort({ callTime: -1 });
    res.json(callHistories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/call-histories/agent/:agentId
router.get('/agent/:agentId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.params.agentId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const callHistories = await CallHistory.find({ agentId: req.params.agentId })
      .populate('customerId', 'customerName')
      .populate('agentId', 'agentName')
      .sort({ callTime: -1 });
    res.json(callHistories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.get("/all", auth, async (req, res) => {
  try {
    const todayStart = moment().startOf("day").toDate();
    const todayEnd = moment().endOf("day").toDate();

    const yesterdayStart = moment().subtract(1, "day").startOf("day").toDate();
    const yesterdayEnd = moment().subtract(1, "day").endOf("day").toDate();

    const nextDayStart = moment().add(1, "day").startOf("day").toDate();

    let filter = {};

    // ✅ Admin ko sabka data milega
    // ✅ Agent ko sirf apna data milega
    if (req.user.role !== "admin") {
      filter.agentId = req.user._id;
    }

    // ✅ Important: filter apply
    const data = await CallHistory.find(filter)
      .populate("customerId")
      .populate("agentId");

    const result = {
      yesterday: [],
      today: [],
      next: []
    };

    data.forEach(item => {
      const callDate = item.nextCallDateTime;
      if (!callDate) return;

      if (callDate >= yesterdayStart && callDate <= yesterdayEnd) {
        result.yesterday.push(item);
      } else if (callDate >= todayStart && callDate <= todayEnd) {
        result.today.push(item);
      } else if (callDate >= nextDayStart) {
        result.next.push(item);
      }
    });

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default router;
