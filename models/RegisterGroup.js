const mongoose = require('mongoose');

const registerGroupSchema = new mongoose.Schema(
  {
    centerName: { type: String, required: true },
    Grade: { type: String, required: true },
    gradeType: { type: String, required: true },
    groupTime: { type: String, required: true },
    displayText: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

registerGroupSchema.index({ centerName: 1, Grade: 1, gradeType: 1, groupTime: 1 }, { unique: true });

const RegisterGroup = mongoose.model('RegisterGroup', registerGroupSchema);

module.exports = RegisterGroup;


