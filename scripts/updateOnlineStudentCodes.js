/**
 * Script to update Online students' codes from O prefix to K prefix
 * 
 * This script finds all students in the 'Online' center and updates their
 * codes from starting with 'O' to starting with 'K'.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('Error connecting to MongoDB:', err);
  process.exit(1);
});

async function updateOnlineStudentCodes() {
  try {
    console.log('Starting to update Online student codes from O to K...');
    
    // Find all students in the Online center with codes starting with O
    const students = await User.find({ 
      centerName: 'Online',
      Code: { $regex: /^[Oo]\d+$/ } // Match codes starting with O or o followed by digits
    });
    
    console.log(`Found ${students.length} Online students with O-prefixed codes`);
    
    let updatedCount = 0;
    let errors = 0;
    
    // Process each student
    for (const student of students) {
      try {
        // Extract the numeric part of the code
        const numericPart = student.Code.substring(1);
        
        // Create the new code with K prefix
        const newCode = 'K' + numericPart;
        
        console.log(`Updating student ${student.Username}: ${student.Code} -> ${newCode}`);
        
        // Update the student's code
        await User.updateOne(
          { _id: student._id },
          { $set: { Code: newCode } }
        );
        
        updatedCount++;
      } catch (error) {
        console.error(`Error updating student ${student.Username} (${student._id}):`, error);
        errors++;
      }
    }
    
    console.log(`
====== Update Summary ======
Total students processed: ${students.length}
Successfully updated: ${updatedCount}
Errors: ${errors}
============================
    `);
    
  } catch (error) {
    console.error('Error in updateOnlineStudentCodes:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the update function
updateOnlineStudentCodes();
