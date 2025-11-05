import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/database.js';

const app = express();

// Connect to DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
import authRoutes from './routes/auth.js';
import agentsRoutes from './routes/agents.js';
import customersRoutes from './routes/customers.js';
import callHistoriesRoutes from './routes/callHistories.js';
import uploadsRoutes from './routes/uploads.js';

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/call-histories', callHistoriesRoutes);
app.use('/api/uploads', uploadsRoutes);

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
