const mongoose = require('mongoose');
const { required } = require('nodemon/lib/config');
const { ref } = require('pdfkit');
const Schema = mongoose.Schema;

const attendanceSchema = new Schema(
  {
    date: String, // 'YYYY-MM-DD'
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    studentsPresent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    studentsAbsent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    studentsLate: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isFinalized: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
