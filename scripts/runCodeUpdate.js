/**
 * Script to run the code update process
 * 
 * This script provides a command-line interface to update student codes
 * with different prefixes based on their center.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const readline = require('readline');
require('dotenv').config();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// Function to update codes for a specific center and prefix
async function updateCodes(centerName, oldPrefix, newPrefix) {
  try {
    console.log(`Starting to update ${centerName} student codes from ${oldPrefix} to ${newPrefix}...`);
    
    // Create regex patterns for old prefix (case insensitive)
    const oldPrefixRegex = new RegExp(`^${oldPrefix}\\d+$`, 'i');
    
    // Find all students in the specified center with codes matching the old prefix
    const students = await User.find({ 
      centerName: centerName,
      Code: { $regex: oldPrefixRegex }
    });
    
    console.log(`Found ${students.length} ${centerName} students with ${oldPrefix}-prefixed codes`);
    
    let updatedCount = 0;
    let errors = 0;
    
    // Process each student
    for (const student of students) {
      try {
        // Extract the numeric part of the code (regardless of case)
        const numericPart = student.Code.substring(1);
        
        // Create the new code with the new prefix
        const newCode = newPrefix + numericPart;
        
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
Center: ${centerName}
Old Prefix: ${oldPrefix} -> New Prefix: ${newPrefix}
Total students processed: ${students.length}
Successfully updated: ${updatedCount}
Errors: ${errors}
============================
    `);
    
    return { total: students.length, updated: updatedCount, errors };
  } catch (error) {
    console.error(`Error in updateCodes for ${centerName}:`, error);
    return { total: 0, updated: 0, errors: 1 };
  }
}

// Function to display the menu and handle user input
function displayMenu() {
  console.log(`
=== Student Code Update Tool ===
1. Update Online students from O to K
2. Update GTA students from G to another prefix
3. Update codes for a custom center and prefix
4. Exit
===============================
  `);
  
  rl.question('Select an option (1-4): ', async (answer) => {
    switch (answer) {
      case '1':
        await updateCodes('Online', 'O', 'K');
        askToContinue();
        break;
      case '2':
        rl.question('Enter new prefix for GTA students: ', async (newPrefix) => {
          if (!newPrefix) {
            console.log('Invalid prefix. Operation cancelled.');
            askToContinue();
            return;
          }
          await updateCodes('GTA', 'G', newPrefix);
          askToContinue();
        });
        break;
      case '3':
        rl.question('Enter center name (e.g., Online, GTA, tagmo3): ', (center) => {
          if (!center) {
            console.log('Invalid center name. Operation cancelled.');
            askToContinue();
            return;
          }
          rl.question('Enter old prefix: ', (oldPrefix) => {
            if (!oldPrefix) {
              console.log('Invalid old prefix. Operation cancelled.');
              askToContinue();
              return;
            }
            rl.question('Enter new prefix: ', async (newPrefix) => {
              if (!newPrefix) {
                console.log('Invalid new prefix. Operation cancelled.');
                askToContinue();
                return;
              }
              await updateCodes(center, oldPrefix, newPrefix);
              askToContinue();
            });
          });
        });
        break;
      case '4':
        console.log('Exiting...');
        await mongoose.disconnect();
        rl.close();
        break;
      default:
        console.log('Invalid option. Please try again.');
        askToContinue();
    }
  });
}

// Function to ask if user wants to continue
function askToContinue() {
  rl.question('Do you want to continue? (y/n): ', async (answer) => {
    if (answer.toLowerCase() === 'y') {
      displayMenu();
    } else {
      console.log('Exiting...');
      await mongoose.disconnect();
      rl.close();
    }
  });
}

// Start the program
console.log('Student Code Update Tool');
displayMenu();

// Handle readline close
rl.on('close', () => {
  console.log('Goodbye!');
  process.exit(0);
});
