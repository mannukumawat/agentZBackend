const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const deleteAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await User.deleteOne({ role: 'admin' });
    if (result.deletedCount > 0) {
      console.log('Admin user deleted successfully');
    } else {
      console.log('No admin user found to delete');
    }

  } catch (error) {
    console.error('Error deleting admin:', error);
  } finally {
    await mongoose.connection.close();
  }
};

deleteAdmin();
