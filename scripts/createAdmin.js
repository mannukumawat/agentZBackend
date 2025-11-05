const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    const admin = new User({
      agentName: 'Admin12',
      agentId: 'ADMIN002',
      email: 'admin12@example.com',
      mobile: '1234567890',
      password: 'admin12345',
      role: 'admin'
    });

    await admin.save();
    console.log('Admin user created successfully');
    console.log('Email: ' + admin.email);
    console.log('Password: ' + admin.password);

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await mongoose.connection.close();
  }
};

createAdmin();
