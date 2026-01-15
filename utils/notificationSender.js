/**
 * Notification Sender Utility
 * 
 * This module provides functions for sending push notifications to users
 * via Firebase Cloud Messaging (FCM), replacing SMS functionality.
 * 
 * Features:
 * - Send notifications to users by phone number
 * - Send notifications to parents (all students of a parent)
 * - Professional, detailed notification messages
 * - Automatic FCM token lookup from User model
 */

const { sendNotification, sendNotificationToParent, sendNotificationBatch } = require('./fcm');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Normalize phone number for lookup
 * @param {string} phone - Phone number to normalize
 * @returns {string} - Normalized phone number
 */
function normalizePhone(phone) {
  if (!phone) return '';
  // Remove all non-digit characters
  return String(phone).replace(/\D/g, '');
}

/**
 * Find user by phone number (student or parent)
 * @param {string} phone - Phone number to search for
 * @returns {Promise<Object|null>} - User object or null
 */
async function findUserByPhone(phone) {
  if (!phone) return null;
  
  const normalizedPhone = normalizePhone(phone);
  
  // Try to find by student phone first
  let user = await User.findOne({ 
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: new RegExp(normalizedPhone.slice(-9)) } } // Last 9 digits
    ],
    fcmToken: { $ne: null }
  });
  
  // If not found, try parent phone
  if (!user) {
    user = await User.findOne({ 
      $or: [
        { parentPhone: normalizedPhone },
        { parentPhone: { $regex: new RegExp(normalizedPhone.slice(-9)) } } // Last 9 digits
      ],
      fcmToken: { $ne: null }
    });
  }
  
  return user;
}

/**
 * Format clean notification message
 * @param {string} baseMessage - Base message text
 * @param {object} details - Additional details to include
 * @returns {object} - Formatted title and body
 */
function formatNotificationMessage(baseMessage, details = {}) {
  let title = 'Elkably';
  let body = baseMessage;
  
  // Check if message already has emojis (attendance messages)
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(baseMessage);
  
  // If message has - separator after emoji, use first part as title
  if (hasEmoji && baseMessage.includes(' - ')) {
    const parts = baseMessage.split(' - ');
    if (parts.length > 1) {
      title = parts[0].trim();
      body = parts.slice(1).join(' - ').trim();
    }
  } else if (baseMessage.includes(':') && !hasEmoji) {
    // Legacy format with colon
    const parts = baseMessage.split(':');
    if (parts.length > 1) {
      title = parts[0].trim();
      body = parts.slice(1).join(':').trim();
    }
  }
  
  // Only add details if no emoji (legacy messages)
  if (!hasEmoji && Object.keys(details).length > 0) {
    const detailLines = [];
    
    if (details.studentCode) {
      detailLines.push(`Code: ${details.studentCode}`);
    }
    if (details.studentName) {
      detailLines.push(`Student: ${details.studentName}`);
    }
    if (details.grade) {
      detailLines.push(`Grade: ${details.grade}`);
    }
    if (details.centerName) {
      detailLines.push(`Center: ${details.centerName}`);
    }
    if (details.balance !== undefined) {
      detailLines.push(`Balance: ${details.balance}`);
    }
    if (details.link) {
      detailLines.push(`${details.link}`);
    }
    
    if (detailLines.length > 0) {
      body = `${body}\n${detailLines.join(' | ')}`;
    }
  }
  
  return { title, body };
}

/**
 * Determine notification type from message content
 * @param {string} message - Message text
 * @param {object} details - Additional details
 * @returns {string} - Notification type
 */
function determineNotificationType(message, details = {}) {
  if (details.type) return details.type;
  
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('present') || lowerMsg.includes('late') || lowerMsg.includes('absent')) {
    return 'attendance';
  }
  if (lowerMsg.includes('homework') || lowerMsg.includes('hw:')) {
    return 'homework';
  }
  if (lowerMsg.includes('paid') || lowerMsg.includes('payment') || lowerMsg.includes('balance')) {
    return 'payment';
  }
  if (lowerMsg.includes('suspended') || lowerMsg.includes('🚫')) {
    return 'block';
  }
  if (lowerMsg.includes('reactivated')) {
    return 'unblock';
  }
  return 'custom';
}

/**
 * Save notification to database
 * @param {Object} params - Notification parameters
 * @returns {Promise<Object|null>} - Saved notification or null
 */
async function saveNotification({ studentId, parentPhone, type, title, body, data }) {
  try {
    const notification = new Notification({
      studentId,
      parentPhone: normalizePhone(parentPhone),
      type: type || 'custom',
      title,
      body,
      data: data || {},
      isRead: false
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error saving notification to database:', error);
    return null;
  }
}

/**
 * Send notification to a user by phone number
 * @param {string} phone - Phone number (student or parent)
 * @param {string} message - Message text
 * @param {object} details - Additional details (studentCode, studentName, grade, etc.)
 * @param {string} countryCode - Country code (optional, for compatibility)
 * @param {string} studentId - Student ID (optional, for saving to DB)
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendNotificationMessage(phone, message, details = {}, countryCode = '20', studentId = null) {
  try {
    if (!phone || !message) {
      return { success: false, message: 'Phone number and message are required' };
    }
    
    // Format the notification message
    const { title, body } = formatNotificationMessage(message, details);
    
    // Find user by phone
    const user = await findUserByPhone(phone);
    
    // Determine notification type
    const notificationType = determineNotificationType(message, details);
    
    // Get studentId from user if not provided
    const finalStudentId = studentId || (user ? user._id : null);
    
    if (!user || !user.fcmToken) {
      // If user not found or no FCM token, try sending to parent
      const normalizedPhone = normalizePhone(phone);
      const result = await sendNotificationToParent(
        normalizedPhone,
        title,
        body,
        {
          type: notificationType,
          timestamp: new Date().toISOString(),
          ...details
        }
      );
      
      if (result.sent > 0) {
        // Save notification to database
        if (finalStudentId) {
          await saveNotification({
            studentId: finalStudentId,
            parentPhone: phone,
            type: notificationType,
            title,
            body,
            data: { ...details, sentVia: 'fcm_parent' }
          });
        }
        return { success: true, data: result, message: `Sent to ${result.sent} device(s)` };
      }
      
      return { 
        success: false, 
        message: 'No user found with FCM token for this phone number' 
      };
    }
    
    // Send notification to the user
    const result = await sendNotification(
      user.fcmToken,
      title,
      body,
      {
        type: notificationType,
        timestamp: new Date().toISOString(),
        ...details
      }
    );
    
    if (result.success) {
      // Save notification to database
      await saveNotification({
        studentId: finalStudentId || user._id,
        parentPhone: phone,
        type: notificationType,
        title,
        body,
        data: { ...details, sentVia: 'fcm_direct' }
      });
      return { success: true, data: result };
    } else {
      return { success: false, message: result.message || 'Failed to send notification' };
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to send notification',
      error: error
    };
  }
}

/**
 * Send student registration notification - clean format
 * @param {string} phone - Student or parent phone number
 * @param {string} studentCode - Student code
 * @param {object} studentInfo - Student information object
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendStudentRegistrationNotification(phone, studentCode, studentInfo = {}) {
  const firstName = (studentInfo.studentName || studentInfo.Username || '').split(' ')[0];
  const message = `🎉 Welcome ${firstName}! - Registered\nCode: ${studentCode}\n${studentInfo.centerName || ''} ${studentInfo.Grade || ''} ${studentInfo.groupTime || ''}`;
  
  return await sendNotificationMessage(phone, message, { type: 'custom' }, '20', studentInfo.studentId || null);
}

/**
 * Send verification code notification - clean format
 * @param {string} phone - Phone number
 * @param {string} code - Verification code
 * @param {string} countryCode - Country code (optional)
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendVerificationCodeNotification(phone, code, countryCode = '20', studentId = null) {
  const message = `🔐 Verification Code - ${code}\nExpires in 15 min`;
  
  return await sendNotificationMessage(phone, message, {
    type: 'custom',
    code: code
  }, countryCode, studentId);
}

/**
 * Send password reset notification - clean format
 * @param {string} phone - Phone number
 * @param {string} resetLink - Password reset link
 * @param {string} countryCode - Country code (optional)
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendPasswordResetNotification(phone, resetLink, countryCode = '20', studentId = null) {
  const message = `🔑 Password Reset\n${resetLink}\nExpires in 15 min`;
  
  return await sendNotificationMessage(phone, message, {
    type: 'custom',
    link: resetLink
  }, countryCode, studentId);
}

/**
 * Send notification to multiple users by phone numbers
 * @param {string[]} phones - Array of phone numbers
 * @param {string} message - Message text
 * @param {object} details - Additional details
 * @returns {Promise<{success: boolean, sent: number, failed: number, results: array}>}
 */
async function sendNotificationBatchByPhones(phones, message, details = {}) {
  try {
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return { success: false, message: 'Phone numbers array is required', sent: 0, failed: 0 };
    }
    
    if (!message) {
      return { success: false, message: 'Message is required', sent: 0, failed: 0 };
    }
    
    // Format the notification message
    const { title, body } = formatNotificationMessage(message, details);
    
    // Determine notification type
    const notificationType = determineNotificationType(message, details);
    
    // Find all users with FCM tokens
    const normalizedPhones = phones.map(p => normalizePhone(p));
    const users = await User.find({
      $or: [
        { phone: { $in: normalizedPhones } },
        { parentPhone: { $in: normalizedPhones } }
      ],
      fcmToken: { $ne: null }
    });
    
    if (users.length === 0) {
      return { success: true, message: 'No users with FCM tokens found', sent: 0, failed: 0 };
    }
    
    // Collect FCM tokens
    const fcmTokens = users.map(u => u.fcmToken).filter(token => token);
    
    if (fcmTokens.length === 0) {
      return { success: true, message: 'No valid FCM tokens found', sent: 0, failed: 0 };
    }
    
    // Send batch notification
    const result = await sendNotificationBatch(
      fcmTokens,
      title,
      body,
      {
        type: notificationType,
        timestamp: new Date().toISOString(),
        ...details
      }
    );
    
    // Save notifications to database for each user
    const savePromises = users.map(user => 
      saveNotification({
        studentId: user._id,
        parentPhone: user.parentPhone || user.phone,
        type: notificationType,
        title,
        body,
        data: { ...details, sentVia: 'fcm_batch' }
      })
    );
    await Promise.all(savePromises);
    
    return {
      success: true,
      sent: result.sent,
      failed: result.failed,
      total: fcmTokens.length
    };
  } catch (error) {
    console.error('Error sending batch notifications:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to send batch notifications',
      sent: 0,
      failed: 0
    };
  }
}

module.exports = {
  sendNotificationMessage,
  sendStudentRegistrationNotification,
  sendVerificationCodeNotification,
  sendPasswordResetNotification,
  sendNotificationBatchByPhones,
  formatNotificationMessage,
  findUserByPhone,
  saveNotification,
  determineNotificationType,
};

