const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const s3 = require('../config/s3');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Local storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.filename));
  },
});

const upload = multer({ storage });

// For S3, use memory storage
const memoryStorage = multer.memoryStorage();
const uploadS3 = multer({ storage: memoryStorage });

// POST /api/uploads - Local or S3
router.post('/', auth, uploadS3.single('file'), async (req, res) => {
  try {
    let fileUrl;

    if (process.env.AWS_ACCESS_KEY_ID) {
      // Upload to S3
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: Date.now() + path.extname(req.file.originalname),
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: 'public-read',
      };
      const result = await s3.upload(params).promise();
      fileUrl = result.Location;
    } else {
      // Local storage
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      const filename = Date.now() + path.extname(req.file.originalname);
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, req.file.buffer);
      fileUrl = `${req.protocol}://${req.get('host')}/${uploadDir}/${filename}`;
    }

    res.json({ fileUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
