const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config');
const { ref } = require('pdfkit');
const Schema = mongoose.Schema


const groupSchema = new Schema(
  {
    CenterName: {
      type: String,
      required: true,
    },
    Grade: {
      type: String,
      required: true,
    },
    gradeType: {
      type: String,
      required: true,
    },
    GroupTime: {
      type: String,
      required: true,
    },
    displayText: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    related: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Ensure uniqueness per center/grade/type/time
groupSchema.index({ CenterName: 1, Grade: 1, gradeType: 1, GroupTime: 1 }, { unique: true });

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;