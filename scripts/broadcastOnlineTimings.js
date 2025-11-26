require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendSmsMessage } = require('../utils/smsSender');

// CLI flags
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').trim(); // e.g. --only=SAT,EST2
const RECIPIENT = (args.find((a) => a.startsWith('--to=')) || '').replace('--to=', '').trim(); // parents | students | both

// Mapping of Online groups to their new timings
// Keys are tuples of [Grade, gradeType]
const onlineTimingMap = [
  { grade: 'SAT', gradeType: 'adv', groupName: 'SAT Advanced', timings: 'Monday @ 8:30 & Friday @ 4' },
  { grade: 'SAT', gradeType: 'newAdv', groupName: 'SAT Advanced', timings: 'Monday @ 8:30 & Friday @ 4' },
  { grade: 'EST', gradeType: 'adv', groupName: 'EST Advanced', timings: 'Monday @ 4 & Friday @ 9' },
  { grade: 'ACT2', gradeType: 'normal', groupName: 'ACT 2', timings: 'Saturday @ 2 & Thursday @ 4' },
  { grade: 'Basics', gradeType: 'normal', groupName: 'Basics', timings: 'Friday @ 2' },
  { grade: 'EST2', gradeType: 'normal', groupName: 'EST 2', timings: 'Friday @ 10' },
];

function shouldIncludeByOnlyFlag(groupName) {
  if (!ONLY) return true;
  // --only accepts comma-separated names matching groupName words (case-insensitive), e.g. SAT,EST2,Basics
  const tokens = ONLY.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const key = groupName.toLowerCase();
  return tokens.some((t) => key.includes(t));
}

function formatPhoneEgypt(countryCode, rawPhone) {
  // Normalize and build phone number for SMS (e.g., 2011XXXXXXXXX)
  const cc = (countryCode || '20').replace(/\D/g, '');
  let phone = String(rawPhone || '').replace(/\D/g, '');
  if (!phone) return null;

  if (phone.startsWith(cc)) {
    return phone; // already prefixed with country code
  }
  if (phone.startsWith('0')) {
    return cc + phone.slice(1);
  }
  // Fallback: prefix country code
  return cc + phone;
}

function buildMessage(groupName, timings) {
  return `Please be informed that these are your timings for "${groupName}" :\n${timings}`;
}

async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function sendToNumber(number, message) {
  if (DRY_RUN) {
    console.log('[DRY-RUN] Would send to', number, '\n', message);
    return;
  }
  
  try {
    // Extract country code from number (assuming Egyptian numbers start with 20)
    const countryCode = '20';
    
    // Send SMS using the SMS sender utility
    const response = await sendSmsMessage(number, message, countryCode);
    
    if (!response.success) {
      throw new Error(`Failed to send SMS: ${response.message}`);
    }
    
    console.log('SMS sent successfully to:', number);
  } catch (error) {
    console.error('Error sending SMS to', number, ':', error.message);
    throw error;
  }
}

async function run() {
  const dbURI = process.env.MONGODB_URI || 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/elkably?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });

  let totalRecipients = 0;
  let totalGroupsProcessed = 0;

  for (const cfg of onlineTimingMap) {
    if (!shouldIncludeByOnlyFlag(cfg.groupName)) continue;

    const users = await User.find({ centerName: 'Online', Grade: cfg.grade, gradeType: cfg.gradeType }).lean();
    if (!users.length) continue;

    totalGroupsProcessed++;

    const message = buildMessage(cfg.groupName, cfg.timings);
    const sentSet = new Set();

    for (const u of users) {
      const targets = [];
      const to = (RECIPIENT || 'both').toLowerCase();
      if (to === 'parents' || to === 'both') {
        const n = formatPhoneEgypt(u.parentPhoneCountryCode, u.parentPhone);
        if (n) targets.push(n);
      }
      if (to === 'students' || to === 'both') {
        const n = formatPhoneEgypt(u.phoneCountryCode, u.phone);
        if (n) targets.push(n);
      }

      for (const num of targets) {
        if (sentSet.has(num)) continue; // avoid duplicates within same group
        try {
          await sendToNumber(num, message);
          sentSet.add(num);
          totalRecipients++;
        } catch (e) {
          console.error('Failed sending to', num, e.message);
        }
        // Random delay 1-3s between messages to be gentle
        const ms = 1000 + Math.floor(Math.random() * 2000);
        await delay(ms);
      }
    }
  }

  console.log(`Done. Groups processed: ${totalGroupsProcessed}, recipients sent: ${totalRecipients}${DRY_RUN ? ' (dry-run)' : ''}.`);
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error('Broadcast failed:', e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});


