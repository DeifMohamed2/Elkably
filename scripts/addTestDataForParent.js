/**
 * Script to add temporary test data for all students related to a parent phone number
 * Usage: node scripts/addTestDataForParent.js <parent_phone_number>
 * 
 * This script adds:
 * - Attendance records with all statuses (Present, Absent, Late, Present From Other Group)
 * - All types of homework statuses
 * - Various dates to simulate attendance history
 * - Realistic test data for comprehensive testing
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Group = require('../models/Group');
const Attendance = require('../models/Attendance');
require('dotenv').config();

// Configuration
const dbURI = 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/elkably?retryWrites=true&w=majority&appName=Cluster0';
const PARENT_PHONE = process.argv[2];

// Homework status options
const HW_STATUSES = [
  'HomeWork not submitted',
  'HomeWork submitted without steps',
  'HomeWork submitted with steps'
];

// Attendance statuses
const ATTENDANCE_STATUSES = [
  'Present',
  'Absent',
  'Late',
  'Present From Other Group'
];

/**
 * Generate random date within the last 30 days
 */
function getRandomPastDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
  }).format(date);
}

/**
 * Generate random time
 */
function getRandomTime() {
  const hours = Math.floor(Math.random() * 12) + 8; // 8 AM to 8 PM
  const minutes = Math.floor(Math.random() * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
}

/**
 * Add test attendance records to a student
 */
async function addTestAttendanceRecords(student) {
  try {
    console.log(`\nAdding test attendance records for student: ${student.Username} (${student.Code})`);
    
    // Get student's group
    let group = null;
    if (student.centerName && student.Grade && student.gradeType && student.groupTime) {
      group = await Group.findOne({
        CenterName: student.centerName,
        Grade: student.Grade,
        gradeType: student.gradeType,
        GroupTime: student.groupTime
      });
    }

    // Initialize attendance history if it doesn't exist
    if (!student.AttendanceHistory || !Array.isArray(student.AttendanceHistory)) {
      student.AttendanceHistory = [];
    }

    // Generate test attendance records for the last 30 days
    const recordsAdded = [];
    const datesUsed = new Set(); // Track dates to avoid duplicates

    // Add 20-25 random attendance records
    const numRecords = Math.floor(Math.random() * 6) + 20; // 20-25 records
    let attempts = 0;
    const maxAttempts = numRecords * 3; // Prevent infinite loop

    while (recordsAdded.length < numRecords && attempts < maxAttempts) {
      attempts++;
      // Get a random date in the past 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const date = getRandomPastDate(daysAgo);
      
      // Skip if we already have a record for this date
      if (datesUsed.has(date)) {
        continue;
      }
      datesUsed.add(date);

      // Randomly select status (weighted towards Present)
      let status;
      const rand = Math.random();
      if (rand < 0.5) {
        status = 'Present';
      } else if (rand < 0.7) {
        status = 'Absent';
      } else if (rand < 0.9) {
        status = 'Late';
      } else {
        status = 'Present From Other Group';
      }

      // Randomly select homework status
      const hwStatus = HW_STATUSES[Math.floor(Math.random() * HW_STATUSES.length)];

      // Generate random amounts
      const amountPaid = Math.floor(Math.random() * 1000) + 100;
      const amountRemaining = Math.max(0, Math.floor(Math.random() * 500));

      // Create attendance record entry
      const attendanceRecord = {
        date: date,
        atTime: getRandomTime(),
        status: status,
        homeworkStatus: hwStatus,
        amountPaid: amountPaid,
        amountRemaining: amountRemaining,
        attendance: group ? group._id : null
      };

      // Add to student's attendance history
      student.AttendanceHistory.push(attendanceRecord);
      recordsAdded.push(attendanceRecord);

      // Also create/update Attendance document if group exists
      if (group) {
        let attendance = await Attendance.findOne({
          date: date,
          groupId: group._id,
          isSolving: false
        });

        if (!attendance) {
          attendance = new Attendance({
            date: date,
            groupId: group._id,
            studentsPresent: [],
            studentsAbsent: [],
            studentsLate: [],
            studentsExcused: [],
            isFinalized: Math.random() > 0.3, // 70% finalized
            isSolving: false
          });
        }

        // Add student to appropriate array based on status
        if (status === 'Present') {
          if (!attendance.studentsPresent.some(id => id.equals(student._id))) {
            attendance.studentsPresent.push(student._id);
          }
        } else if (status === 'Absent') {
          if (!attendance.studentsAbsent.some(id => id.equals(student._id))) {
            attendance.studentsAbsent.push(student._id);
          }
        } else if (status === 'Late') {
          if (!attendance.studentsLate.some(id => id.equals(student._id))) {
            attendance.studentsLate.push(student._id);
          }
        } else if (status === 'Present From Other Group') {
          if (!attendance.studentsExcused.some(id => id.equals(student._id))) {
            attendance.studentsExcused.push(student._id);
          }
        }

        await attendance.save();
      }
    }

    // Update student's absences count based on records
    const absentCount = student.AttendanceHistory.filter(r => r.status === 'Absent').length;
    student.absences = Math.min(absentCount, 5); // Cap at 5 for testing

    // Update balance and amount remaining based on latest records
    if (student.AttendanceHistory.length > 0) {
      const latestRecord = student.AttendanceHistory[student.AttendanceHistory.length - 1];
      student.balance = latestRecord.amountPaid || student.balance || 0;
      student.amountRemaining = latestRecord.amountRemaining || student.amountRemaining || 0;
    }

    // Mark AttendanceHistory as modified
    student.markModified('AttendanceHistory');
    await student.save();

    console.log(`✓ Added ${recordsAdded.length} attendance records`);
    console.log(`  - Present: ${recordsAdded.filter(r => r.status === 'Present').length}`);
    console.log(`  - Absent: ${recordsAdded.filter(r => r.status === 'Absent').length}`);
    console.log(`  - Late: ${recordsAdded.filter(r => r.status === 'Late').length}`);
    console.log(`  - Present From Other Group: ${recordsAdded.filter(r => r.status === 'Present From Other Group').length}`);
    console.log(`  - Updated absences: ${student.absences}`);
    console.log(`  - Updated balance: ${student.balance}`);
    console.log(`  - Updated amount remaining: ${student.amountRemaining}`);

    return {
      success: true,
      recordsAdded: recordsAdded.length,
      student: student.Username,
      code: student.Code
    };
  } catch (error) {
    console.error(`Error adding test data for student ${student.Username}:`, error);
    return {
      success: false,
      student: student.Username,
      error: error.message
    };
  }
}

/**
 * Main function
 */
async function run() {
  try {
    if (!PARENT_PHONE) {
      console.error('Error: Parent phone number is required');
      console.log('Usage: node scripts/addTestDataForParent.js <parent_phone_number>');
      process.exit(1);
    }

    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(dbURI);
    console.log('Connected to MongoDB.');

    console.log(`\nSearching for students with parent phone: ${PARENT_PHONE}...`);
    
    // Normalize phone number
    const normalizedPhone = PARENT_PHONE.replace(/\D/g, '');
    
    // Find all students with this parent phone number
    const students = await User.find({
      $or: [
        { parentPhone: normalizedPhone },
        { parentPhone: { $regex: new RegExp(normalizedPhone.slice(-9)) } }
      ],
      isTeacher: { $ne: true } // Exclude teachers
    });

    if (!students || students.length === 0) {
      console.error(`Error: No students found with parent phone number ${PARENT_PHONE}`);
      process.exit(1);
    }

    console.log(`Found ${students.length} student(s) for this parent:`);
    students.forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.Username} (Code: ${student.Code}, Center: ${student.centerName})`);
    });

    console.log('\n--- Adding Test Data ---\n');

    const results = [];
    for (const student of students) {
      const result = await addTestAttendanceRecords(student);
      results.push(result);
    }

    console.log('\n--- Summary ---');
    console.log(`Total students processed: ${students.length}`);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed students:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.student}: ${r.error}`);
      });
    }

    const totalRecords = results.reduce((sum, r) => sum + (r.recordsAdded || 0), 0);
    console.log(`\nTotal attendance records added: ${totalRecords}`);

    // Wait a bit for async operations to finish
    setTimeout(() => {
      mongoose.connection.close();
      console.log('\nDatabase connection closed.');
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

run();
