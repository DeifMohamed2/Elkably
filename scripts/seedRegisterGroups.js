require('dotenv').config();
const mongoose = require('mongoose');
const RegisterGroup = require('../models/RegisterGroup');

async function main() {
  const dbURI = process.env.MONGODB_URI || 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/elkably?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });

  const seeds = [
    // GTA
    { centerName: 'GTA', Grade: 'EST', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Saturday & Tuesday @ 6PM' },
    { centerName: 'GTA', Grade: 'EST', gradeType: 'adv', groupTime: 'TEST', displayText: 'TEST' },
    { centerName: 'GTA', Grade: 'Basics', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Monday @ 6PM & Friday @ 5PM' },
    { centerName: 'GTA', Grade: 'SAT', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Saturday @ 3:30PM & Tuesday @ 8PM' },

    // tagmo3
    { centerName: 'tagmo3', Grade: 'EST', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Sunday @ 6:30PM & Wednesday @ 4:30PM' },
    { centerName: 'tagmo3', Grade: 'Basics', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Sunday & Wednesday @ 8:30PM' },
    { centerName: 'tagmo3', Grade: 'SAT', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Sunday @ 4:30PM & Wednesday @ 6:30PM' },

    // Online
    { centerName: 'Online', Grade: 'EST', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Online' },
    { centerName: 'Online', Grade: 'Basics', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Online' },
    { centerName: 'Online', Grade: 'SAT', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Online' },
    { centerName: 'Online', Grade: 'SAT', gradeType: 'newAdv', groupTime: 'group1', displayText: 'Group(1) - Online' },
    { centerName: 'Online', Grade: 'ACT2', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Online' },
    { centerName: 'Online', Grade: 'ACT', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Online' },
    { centerName: 'Online', Grade: 'ACT', gradeType: 'basic', groupTime: 'group2', displayText: 'Group(2) - Online' },
    { centerName: 'Online', Grade: 'EST2', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Online' },
  ];

  let inserted = 0;
  for (const s of seeds) {
    try {
      await RegisterGroup.updateOne(
        { centerName: s.centerName, Grade: s.Grade, gradeType: s.gradeType, groupTime: s.groupTime },
        { $setOnInsert: s },
        { upsert: true }
      );
      inserted++;
    } catch (e) {
      // ignore duplicates
    }
  }

  console.log(`Seed completed. Processed: ${inserted}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});


