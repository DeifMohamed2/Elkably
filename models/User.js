const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config')
const Schema = mongoose.Schema

const userSchema = new Schema(
  {
    Username: {
      type: String,
      required: true,
    },

    Password: {
      type: String,
      default: '3131',
      required: false,
    },

    Grade: {
      type: String,
      required: true,
    },
    centerName: {
      type: String,
      required: true,
    },
    groupTime: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    parentPhone: {
      type: String,
      required: true,
      unique: false,
    },

    cardId: {
        type: String,
        required: false,
        default: null
    },

    AttendanceHistory: {
        type: Array,
        required: false,
        default: []
    },
    Code: {
      type: Number,
      required: true,
      unique: true,
    },
    absences: {
      type: Number,
      required: true,
      default: 0,
    },

    balance: {
      type: Number,
      required: true,
      default: 0,
    },

    amountRemaining: {
      type: Number,
      required: true,
      default: 0,
    },
    

    subscribe: {
      type: Boolean,
      required: true,
    },

    isTeacher: {
      type: Boolean,
      required: true,
    },




  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema)

module.exports = User;