require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('../models/Group');

function key(center, grade, type, time) {
  return `${center}|${grade}|${type}|${time}`;
}

// Known display names mapping migrated from legacy config
const displayMap = new Map([
  // GTA
  [key('GTA', 'EST', 'adv', 'group1'), 'Group(1) - Saturday & Tuesday @ 6PM'],
  [key('GTA', 'EST', 'adv', 'TEST'), 'TEST'],
  [key('GTA', 'Basics', 'normal', 'group1'), 'Group(1) - Monday @ 6PM & Friday @ 5PM'],
  [key('GTA', 'SAT', 'adv', 'group1'), 'Group(1) - Saturday @ 3:30PM & Tuesday @ 8PM'],

  // tagmo3
  [key('tagmo3', 'EST', 'adv', 'group1'), 'Group(1) - Sunday @ 6:30PM & Wednesday @ 4:30PM'],
  [key('tagmo3', 'Basics', 'normal', 'group1'), 'Group(1) - Sunday & Wednesday @ 8:30PM'],
  [key('tagmo3', 'SAT', 'adv', 'group1'), 'Group(1) - Sunday @ 4:30PM & Wednesday @ 6:30PM'],

  // Online (default online text per group key)
  [key('Online', 'EST', 'adv', 'group1'), 'Group(1) - Online'],
  [key('Online', 'Basics', 'normal', 'group1'), 'Group(1) - Online'],
  [key('Online', 'SAT', 'adv', 'group1'), 'Group(1) - Online'],
  [key('Online', 'SAT', 'newAdv', 'group1'), 'Group(1) - Online'],
  [key('Online', 'ACT2', 'normal', 'group1'), 'Group(1) - Online'],
  [key('Online', 'ACT', 'adv', 'group1'), 'Group(1) - Online'],
  [key('Online', 'ACT', 'basic', 'group2'), 'Group(2) - Online'],
  [key('Online', 'EST2', 'normal', 'group1'), 'Group(1) - Online'],
]);

async function run() {
  const dbURI = process.env.MONGODB_URI || 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/elkably?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });

  let updated = 0;
  for (const [k, text] of displayMap.entries()) {
    const [center, grade, type, time] = k.split('|');
    const res = await Group.updateOne(
      { CenterName: center, Grade: grade, gradeType: type, GroupTime: time },
      { $set: { displayText: text, isActive: true } }
    );
    if (res.matchedCount) updated += res.modifiedCount;
  }

  // Optional: set a generic displayText for any missing ones
  const missing = await Group.find({ $or: [{ displayText: { $exists: false } }, { displayText: null }, { displayText: '' }] });
  for (const g of missing) {
    const generic = g.CenterName === 'Online' ? `Group(${g.GroupTime.replace('group', '')}) - Online` : g.GroupTime;
    await Group.updateOne({ _id: g._id }, { $set: { displayText: generic } });
    updated++;
  }

  console.log(`Updated displayText on ${updated} groups.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error('Seed/migration failed:', e);
  process.exit(1);
});


