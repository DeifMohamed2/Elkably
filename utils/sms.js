const axios = require('axios');

const WHY_SMS_API_URL = 'https://bulk.whysms.com/api/v3/sms/send';
const WHY_SMS_TOKEN = process.env.WHY_SMS_TOKEN;
const DEFAULT_SENDER_ID = 'ELKABLYTEAM';

function normalizeRecipient(recipient) {
  // Trim spaces and leading '+'
  let r = String(recipient).trim().replace(/^\+/, '');
  // Convert local Egyptian mobile like 01XXXXXXXXX to 201XXXXXXXXX
  if (/^0\d{10}$/.test(r)) {
    return `20${r.slice(1)}`;
  }
  // If already starts with 20 and correct length, keep
  if (/^20\d{10}$/.test(r)) {
    return r;
  }
  // If looks like 201XXXXXXXXX with extra spaces or dashes, strip non-digits
  const digits = r.replace(/\D/g, '');
  if (/^20\d{10}$/.test(digits)) {
    return digits;
  }
  // Fallback to original sanitized digits
  return digits || r;
}

async function sendSms({ recipient, message, senderId = DEFAULT_SENDER_ID, type = 'plain' }) {
  if (!recipient || !message) {
    throw new Error('recipient and message are required');
  }

  const normalizedRecipient = normalizeRecipient(recipient);

  const payload = {
    recipient: normalizedRecipient,
    sender_id: senderId,
    type,
    message,
  };

  const headers = {
    Authorization: `Bearer ${WHY_SMS_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const response = await axios.post(WHY_SMS_API_URL, payload, { headers });
    return response.data;
  } catch (error) {
    const details = error.response?.data || error.message;
    const err = new Error('WhySMS API error');
    err.details = details;
    throw err;
  }
}

async function getSmsMessages({ 
  startDate, 
  endDate, 
  smsType, 
  direction,
  from,
  timezone = 'Africa/Cairo',
  page = 1 
} = {}) {
  const WHY_SMS_API_URL = 'https://bulk.whysms.com/api/v3/sms';
  const WHY_SMS_TOKEN = process.env.WHY_SMS_TOKEN;

  if (!WHY_SMS_TOKEN) {
    throw new Error('WHY_SMS_TOKEN is not configured');
  }

  // Build query parameters
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (smsType) params.append('sms_type', smsType);
  if (direction) params.append('direction', direction);
  if (from) params.append('from', from);
  if (timezone) params.append('timezone', timezone);
  if (page) params.append('page', page);

  const url = `${WHY_SMS_API_URL}?${params.toString()}`;

  const headers = {
    Authorization: `Bearer ${WHY_SMS_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    const details = error.response?.data || error.message;
    const err = new Error('WhySMS API error - Failed to fetch messages');
    err.details = details;
    throw err;
  }
}

// Get all messages for statistics (without pagination limit)
async function getAllSmsMessagesForStats({ 
  startDate, 
  endDate, 
  smsType, 
  direction,
  from,
  timezone = 'Africa/Cairo'
} = {}) {
  const WHY_SMS_API_URL = 'https://bulk.whysms.com/api/v3/sms';
  const WHY_SMS_TOKEN = process.env.WHY_SMS_TOKEN;

  if (!WHY_SMS_TOKEN) {
    throw new Error('WHY_SMS_TOKEN is not configured');
  }

  // Build query parameters
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (smsType) params.append('sms_type', smsType);
  if (direction) params.append('direction', direction);
  if (from) params.append('from', from);
  if (timezone) params.append('timezone', timezone);
  // Fetch first page to get total count
  params.append('page', 1);

  const url = `${WHY_SMS_API_URL}?${params.toString()}`;

  const headers = {
    Authorization: `Bearer ${WHY_SMS_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const response = await axios.get(url, { headers });
    const data = response.data;
    
    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to fetch messages');
    }

    // Calculate statistics from all pages
    let allMessages = [];
    let currentPage = 1;
    let totalPages = data.data?.last_page || 1;
    
    // Collect messages from first page
    if (data.data?.data) {
      allMessages = [...data.data.data];
    }

    // Fetch remaining pages if needed (limit to reasonable number to avoid timeout)
    const maxPagesToFetch = 50; // Limit to prevent timeout
    while (currentPage < totalPages && currentPage < maxPagesToFetch) {
      currentPage++;
      params.set('page', currentPage);
      const nextUrl = `${WHY_SMS_API_URL}?${params.toString()}`;
      const nextResponse = await axios.get(nextUrl, { headers });
      const nextData = nextResponse.data;
      
      if (nextData.data?.data && Array.isArray(nextData.data.data)) {
        allMessages = [...allMessages, ...nextData.data.data];
      }
    }

    return {
      total: data.data?.total || allMessages.length,
      messages: allMessages,
      stats: calculateMessageStats(allMessages)
    };
  } catch (error) {
    const details = error.response?.data || error.message;
    const err = new Error('WhySMS API error - Failed to fetch messages for statistics');
    err.details = details;
    throw err;
  }
}

function calculateMessageStats(messages) {
  const stats = {
    total: messages.length,
    delivered: 0,
    pending: 0,
    failed: 0
  };

  messages.forEach(msg => {
    const status = (msg.status || '').toLowerCase();
    if (status.includes('delivered') || status.includes('تم')) {
      stats.delivered++;
    } else if (status.includes('pending') || status.includes('انتظار') || status.includes('queued') || status.includes('processing')) {
      stats.pending++;
    } else if (status.includes('failed') || status.includes('فشل') || status.includes('error') || status.includes('rejected')) {
      stats.failed++;
    } else {
      stats.pending++;
    }
  });

  return stats;
}

module.exports = {
  sendSms,
  getSmsMessages,
  getAllSmsMessagesForStats,
  calculateMessageStats,
};

