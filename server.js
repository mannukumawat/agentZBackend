require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

const app = express();

// Connect to DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/call-histories', require('./routes/callHistories'));
app.use('/api/uploads', require('./routes/uploads'));

// Serve static files for local uploads
if (!process.env.AWS_ACCESS_KEY_ID) {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  app.use(`/${uploadDir}`, express.static(uploadDir));
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
