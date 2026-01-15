const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Group = require('../models/Group');

/**
 * Script to backfill group information for existing attendance records
 * This script:
 * 1. Finds all students
 * 2. For each student, processes their AttendanceHistory
 * 3. For records without attendance reference, tries to find matching Attendance documents
 * 4. Updates records to link to Attendance documents and include group info
 */
async function backfillAttendanceGroups() {
  try {
    // Connect to MongoDB
    const dbURI = process.env.MONGODB_URI || 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/elkably?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Find all students
    const students = await User.find({ isTeacher: { $ne: true } });
    console.log(`Found ${students.length} students to process`);

    let totalUpdated = 0;
    let totalRecordsProcessed = 0;
    let studentsUpdated = 0;

    for (const student of students) {
      if (!student.AttendanceHistory || student.AttendanceHistory.length === 0) {
        continue;
      }

      let studentUpdated = false;
      const attendanceHistory = student.AttendanceHistory;

      // Get student's current group
      let studentGroup = null;
      if (student.centerName && student.Grade && student.gradeType && student.groupTime) {
        studentGroup = await Group.findOne({
          CenterName: student.centerName,
          Grade: student.Grade,
          gradeType: student.gradeType,
          GroupTime: student.groupTime,
        });
      }

      if (!studentGroup) {
        console.log(`Skipping student ${student.Code} - no group found`);
        continue;
      }

      // Process each attendance record
      for (let i = 0; i < attendanceHistory.length; i++) {
        const record = attendanceHistory[i];
        totalRecordsProcessed++;

        // Skip if record already has attendance reference
        if (record.attendance) {
          continue;
        }

        // Try to find matching Attendance document by date and group
        if (record.date) {
          try {
            // Try to find Attendance document for this date and group
            let attendanceDoc = await Attendance.findOne({
              date: record.date,
              groupId: studentGroup._id,
            });

            // If not found, try with isSolving variations
            if (!attendanceDoc) {
              attendanceDoc = await Attendance.findOne({
                date: record.date,
                groupId: studentGroup._id,
                isSolving: false,
              });
            }

            if (attendanceDoc) {
              // Update the record to include attendance reference
              attendanceHistory[i] = {
                ...record,
                attendance: attendanceDoc._id,
              };
              studentUpdated = true;
              totalUpdated++;
            } else {
              // If no Attendance document exists, create one based on the record
              // This ensures future lookups will work
              const newAttendance = new Attendance({
                date: record.date,
                groupId: studentGroup._id,
                studentsPresent: [],
                studentsAbsent: [],
                studentsLate: [],
                studentsExcused: [],
                isFinalized: true, // Mark as finalized since it's historical data
                isSolving: false,
              });

              // Add student to appropriate array based on status
              const status = (record.status || '').toLowerCase();
              if (status.includes('present') && !status.includes('other')) {
                newAttendance.studentsPresent.push(student._id);
              } else if (status.includes('late')) {
                newAttendance.studentsLate.push(student._id);
              } else if (status.includes('absent')) {
                newAttendance.studentsAbsent.push(student._id);
              } else if (status.includes('other') || status.includes('excused')) {
                newAttendance.studentsExcused.push(student._id);
              }

              await newAttendance.save();

              // Update the record to include attendance reference
              attendanceHistory[i] = {
                ...record,
                attendance: newAttendance._id,
              };
              studentUpdated = true;
              totalUpdated++;
            }
          } catch (err) {
            console.error(`Error processing record for student ${student.Code} on ${record.date}:`, err.message);
          }
        }
      }

      // Save student if any records were updated
      if (studentUpdated) {
        student.markModified('AttendanceHistory');
        await student.save();
        studentsUpdated++;
        console.log(`Updated ${student.Code} - ${attendanceHistory.filter(r => r.attendance).length}/${attendanceHistory.length} records now have attendance reference`);
      }
    }

    console.log('\n=== Backfill Summary ===');
    console.log(`Total students processed: ${students.length}`);
    console.log(`Students updated: ${studentsUpdated}`);
    console.log(`Total records processed: ${totalRecordsProcessed}`);
    console.log(`Records updated: ${totalUpdated}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error in backfill script:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
backfillAttendanceGroups();
