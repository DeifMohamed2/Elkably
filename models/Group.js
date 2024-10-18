const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config');
const { ref } = require('pdfkit');
const Schema = mongoose.Schema


const groupSchema = new Schema(
  {
    Grade: {
      type: String,
      required: true,
    },
    CenterName: {
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