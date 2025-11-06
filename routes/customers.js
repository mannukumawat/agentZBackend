import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import s3 from '../config/s3.js';
import Customer from '../models/Customer.js';
import { auth, adminOnly, agentAccess } from '../middleware/auth.js';

const router = express.Router();

// Multer setup for file uploads
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// Helper function to upload file to S3 or local
const uploadFile = async (file) => {
  let fileUrl;
  if (process.env.AWS_ACCESS_KEY_ID) {
    // Upload to S3
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: Date.now() + path.extname(file.originalname),
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };
    const result = await s3.upload(params).promise();
    fileUrl = result.Location;
  } else {
    // Local storage
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filename = Date.now() + path.extname(file.originalname);
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    fileUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/${uploadDir}/${filename}`;
  }
  return fileUrl;
};

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

// POST /api/customers - Admin only
router.post('/', auth, adminOnly, upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panFile', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'incomeProofFiles', maxCount: 10 } // Assuming max 10 income proof files
]), [
  body('customerName').notEmpty(),
  body('mobileNumbers').isArray(),
  body('emails').isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const customerData = { ...req.body };

    // Handle file uploads
    if (req.files) {
      if (req.files.aadhaarFront) {
        customerData.aadhaarFiles = customerData.aadhaarFiles || {};
        customerData.aadhaarFiles.frontUrl = await uploadFile(req.files.aadhaarFront[0]);
      }
      if (req.files.aadhaarBack) {
        customerData.aadhaarFiles = customerData.aadhaarFiles || {};
        customerData.aadhaarFiles.backUrl = await uploadFile(req.files.aadhaarBack[0]);
      }
      if (req.files.panFile) {
        customerData.panFile = await uploadFile(req.files.panFile[0]);
      }
      if (req.files.selfie) {
        customerData.selfie = await uploadFile(req.files.selfie[0]);
      }
      if (req.files.incomeProofFiles) {
        customerData.incomeProofFiles = await Promise.all(req.files.incomeProofFiles.map(file => uploadFile(file)));
      }
    }

    const customer = new Customer(customerData);
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

// PUT /api/customers/:id - Admin only
router.put('/:id', auth, adminOnly, checkCustomerAccess, [
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

export default router;
