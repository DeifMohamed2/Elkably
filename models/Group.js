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
    gradeType :{
      type: String,
      required: true,
    },
    GroupTime: {
      type: String,
      required: true,
    },

    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],


  },
  { timestamps: true }
);

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;