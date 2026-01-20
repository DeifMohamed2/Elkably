const { sendSms } = require('./sms');

const WHATSAPP_LINK = 'https://wa.me/201050994880';
const MIN_MESSAGE_LENGTH = 140;
const MAX_MESSAGE_LENGTH = 160;

/**
* Remove all emojis, special icons and non-English characters from text.
* We keep basic ASCII only so the SMS stays in plain English/GSM charset.
*/
function removeIcons(text) {
  if (!text) return '';

  // First strip emojis and pictographs explicitly
  let cleaned = text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Variation Selectors
    .replace(/[\u{200D}]/gu, '') // Zero Width Joiner
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[✅❌⚠️]/g, '') // Common emoji characters
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/\*/g, ''); // Remove asterisks

  // Then force ASCII-only (English) characters, but keep newlines
  cleaned = cleaned
    .split('\n')
    .map((line) => line.replace(/[^\x20-\x7E]/g, '')) // strip non-ASCII printable chars per line
    .join('\n');

  return cleaned.trim();
}

/**
 * Truncate message to fit within SMS length limits.
 * Preserves vertical formatting (line breaks) while ensuring total length is between
 * MIN_MESSAGE_LENGTH and MAX_MESSAGE_LENGTH including the WhatsApp link.
 */
function formatMessage(message) {
  if (!message) return '';
  
  // Remove icons first
  let cleanMessage = removeIcons(message);
  
  // Normalize line breaks (handle different line break formats)
  cleanMessage = cleanMessage.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Calculate available length (MAX - link length - newline - space)
  const linkLength = WHATSAPP_LINK.length;
  const newlineForLink = 1; // One newline before the link
  const spaceForLink = 1; // Space after newline
  const availableLength = MAX_MESSAGE_LENGTH - linkLength - newlineForLink - spaceForLink;
  
  // Count current message length (including newlines)
  const currentLength = cleanMessage.length;
  
  // If message is too long, truncate it intelligently (prefer word boundaries, no dots)
  if (currentLength > availableLength) {
    let truncated = cleanMessage.substring(0, availableLength);

    // Prefer breaking at the last space or newline to avoid cutting words
    const lastSpace = truncated.lastIndexOf(' ');
    const lastNewline = truncated.lastIndexOf('\n');
    const breakPos = Math.max(lastSpace, lastNewline);

    if (breakPos > -1) {
      truncated = truncated.substring(0, breakPos);
    }

    truncated = truncated.replace(/[\s\n]+$/g, '');
    cleanMessage = truncated;
  }
  
  // Add WhatsApp link at the end with newline
  let finalMessage = cleanMessage + '\n' + WHATSAPP_LINK;
  
  // Final length check
  if (finalMessage.length > MAX_MESSAGE_LENGTH) {
    // Truncate more aggressively but still at word boundaries, no dots
    const maxBaseLen = MAX_MESSAGE_LENGTH - (WHATSAPP_LINK.length + 1); // 1 for newline
    let base = cleanMessage.substring(0, maxBaseLen);

    const lastSpace2 = base.lastIndexOf(' ');
    const lastNewline2 = base.lastIndexOf('\n');
    const breakPos2 = Math.max(lastSpace2, lastNewline2);

    if (breakPos2 > -1) {
      base = base.substring(0, breakPos2);
    }

    base = base.replace(/[\s\n]+$/g, '');
    cleanMessage = base;
    finalMessage = cleanMessage + '\n' + WHATSAPP_LINK;
  }

  return finalMessage;
}

/**
 * Send SMS message
 * @param {string} phone - Phone number (will be normalized)
 * @param {string} message - Message text (will be cleaned and formatted)
 * @param {string} countryCode - Country code (default: '20' for Egypt)
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendSmsMessage(phone, message, countryCode = '20') {
  try {
    if (!phone || !message) {
      return { success: false, message: 'Phone number and message are required' };
    }
    
    // Format the message (remove icons, truncate, add link)
    const formattedMessage = formatMessage(message);
    
    // Normalize phone number
    let phoneNumber = String(phone).trim().replace(/\D/g, '');
    
    // Remove leading zero if present
    if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.slice(1);
    }
    
    // Add country code if not present
    if (!phoneNumber.startsWith(countryCode)) {
      phoneNumber = countryCode + phoneNumber;
    }
    
    // Send SMS
    const result = await sendSms({
      recipient: phoneNumber,
      message: formattedMessage,
      senderId: 'ELKABLYTEAM',
      type: 'plain'
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to send SMS',
      error: error.details || error
    };
  }
}

module.exports = {
  sendSmsMessage,
  formatMessage,
  removeIcons
};
