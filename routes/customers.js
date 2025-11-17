import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import { Readable } from 'stream';
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

// POST /api/customers - Admin only (JSON data with URLs)
router.post('/', auth, adminOnly, [
  body('customerName').notEmpty(),
  body('mobileNumbers').optional().isArray(),
  body('emails').optional().isArray(),
  body('creditScore').optional().isNumeric(),
  body('address').optional().isString(),
  body('pinCode').optional().isString(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('occupation').optional().isIn(['salary', 'non-salary', 'business', 'other']),
  body('income').optional().isNumeric(),
  body('dob').optional().isISO8601(),
  body('aadhaarNumber').optional().isString(),
  body('panNumber').optional().isString(),
  body('aadhaarFiles.frontUrl').optional().isURL(),
  body('aadhaarFiles.backUrl').optional().isURL(),
  body('panFile').optional().isURL(),
  body('selfie').optional().isURL(),
  body('incomeProofFiles').optional().isArray(),
  body('assignedAgentId').optional().isMongoId(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const customerData = { ...req.body };
    const customer = new Customer(customerData);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/customers/upload-csv - Admin only (CSV upload)
router.post('/upload-csv', auth, adminOnly, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const customers = [];
    const batchSize = 1000;

    // ---------- HELPERS ----------
    const cleanNumber = (val) => {
      if (!val || val.trim() === "") return undefined;
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    };

    const cleanDate = (val) => {
      if (!val || val.trim() === "") return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

    const allowedGenders = ["male", "female", "other"];
    const allowedOccupations = ["salaried", "self-employed", "business", "student"];

    // ---------- CSV PARSER ----------
    const csvStream = csv({
      skipEmptyLines: true,
      headers: [
        'customerName',
        'mobileNumbers',
        'emails',
        'creditScore',
        'address',
        'pinCode',
        'gender',
        'occupation',
        'income',
        'dob',
        'aadhaarNumber',
        'panNumber',
        'aadhaarFrontUrl',
        'aadhaarBackUrl',
        'panFileUrl',
        'selfieUrl',
        'incomeProofFiles',
        'assignedAgentId'
      ]
    });

    // ---------- PROCESS EACH ROW ----------
    const processRow = (row, index) => {
      const rowNum = index + 1;

      const customerName = row.customerName?.trim();
      const mobileNumbers = row.mobileNumbers
        ? row.mobileNumbers.split(";").map(m => m.trim())
        : [];

      // Required fields check
      if (!customerName || mobileNumbers.length === 0) {
        console.log(`❌ Skipping row ${rowNum}: Missing required fields`, row);
        return;
      }

      // Clean & Validate
      const gender = row.gender?.trim().toLowerCase();
      const occupation = row.occupation?.trim().toLowerCase();
      const agentId = row.assignedAgentId?.trim();

      if (gender && !allowedGenders.includes(gender)) {
        console.log(`❌ Row ${rowNum}: Invalid gender →`, row.gender);
      }

      if (occupation && !allowedOccupations.includes(occupation)) {
        console.log(`❌ Row ${rowNum}: Invalid occupation →`, row.occupation);
      }

      if (agentId && !isValidObjectId(agentId)) {
        console.log(`❌ Row ${rowNum}: Invalid assignedAgentId →`, row.assignedAgentId);
      }

      const customerData = {
        customerName,
        mobileNumbers,

        emails: row.emails
          ? row.emails.split(";").map(e => e.trim())
          : [],

        creditScore: cleanNumber(row.creditScore),
        income: cleanNumber(row.income),

        dob: cleanDate(row.dob),

        address: row.address?.trim() || undefined,
        pinCode: row.pinCode?.trim() || undefined,

        gender: allowedGenders.includes(gender) ? gender : undefined,
        occupation: allowedOccupations.includes(occupation) ? occupation : undefined,

        aadhaarNumber: row.aadhaarNumber?.trim() || undefined,
        panNumber: row.panNumber?.trim() || undefined,

        aadhaarFiles: {
          frontUrl: row.aadhaarFrontUrl?.trim() || undefined,
          backUrl: row.aadhaarBackUrl?.trim() || undefined,
        },

        panFile: row.panFileUrl?.trim() || undefined,
        selfie: row.selfieUrl?.trim() || undefined,

        incomeProofFiles: row.incomeProofFiles
          ? row.incomeProofFiles.split(";").map(f => f.trim())
          : [],

        assignedAgentId: isValidObjectId(agentId) ? agentId : undefined,
      };

      customers.push(customerData);

      // Batch insert
      if (customers.length >= batchSize) {
        const batch = customers.splice(0, batchSize);
        Customer.insertMany(batch).catch(err =>
          console.error('❌ Batch insert error:', err)
        );
      }
    };

    // ---------- PIPE STREAM ----------
    let rowIndex = 0;
    const bufferStream = Readable.from(req.file.buffer);

    bufferStream
      .pipe(csvStream)
      .on('data', (row) => processRow(row, rowIndex++))
      .on('end', async () => {
        if (customers.length > 0) {
          try {
            await Customer.insertMany(customers);
          } catch (err) {
            console.error("❌ Final batch error:", err);
          }
        }

        const totalInserted = await Customer.countDocuments();

        res.status(201).json({
          message: "CSV uploaded successfully",
          totalInserted
        });
      })
      .on('error', (error) => {
        console.log("❌ CSV parsing error:", error);
        res.status(500).json({ message: error.message });
      });

  } catch (error) {
    console.log("❌ Route error:", error);
    res.status(500).json({ message: error.message });
  }
});





// GET /api/customers - with pagination and filters
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 30, pinCode, agentId } = req.query;

    let query = {};

    // If agent → only his customers
    if (req.user.role === 'agent') {
      query.assignedAgentId = req.user._id;
    }

    // Filters
    if (pinCode) query.pinCode = pinCode;
    if (agentId && req.user.role === 'admin') query.assignedAgentId = agentId;

    // Fetch customers
    const customers = await Customer.find(query)
      .populate('assignedAgentId', 'agentName')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .exec();

    // Count total matching customers
    const count = await Customer.countDocuments(query);

    res.json({
      customers,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalCount: count, // <-- Added this line (TOTAL COUNT)
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

// POST /api/customers/:id/unassign - Admin only
router.post('/:id/unassign', auth, adminOnly, [], async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    customer.assignedAgentId = null;
    await customer.save();
    res.json({ message: 'Customer unassigned', customer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
