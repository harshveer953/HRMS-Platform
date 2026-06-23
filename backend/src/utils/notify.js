const { Notification, Employee } = require('../models');

let nodemailer;
try { nodemailer = require('nodemailer'); } catch(e) { nodemailer = null; }

// Create nodemailer transporter if SMTP configured
function getTransporter() {
  if (!nodemailer) return null;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

/**
 * Send notification: creates in-app notification + optional real email
 * @param {string} tenantId
 * @param {string} employeeId - Target employee DB _id
 * @param {string} title
 * @param {string} message
 * @param {string} type - 'INFO' | 'ACTION_REQUIRED' | 'STATUS_UPDATE' | 'SECURITY'
 * @param {string} recipientEmail - Optional email address for real email delivery
 * @param {string} category - 'leaveUpdates' | 'attendanceAlerts' | 'systemAlerts' | null
 */
async function sendNotification(tenantId, employeeId, title, message, type = 'INFO', recipientEmail = null, category = null) {
  try {
    // Check notification preferences (skip check for SECURITY type — always send)
    if (type !== 'SECURITY' && category && employeeId) {
      try {
        const emp = await Employee.findById(employeeId);
        if (emp && emp.notificationPrefs) {
          const prefs = emp.notificationPrefs;
          // If category-specific pref is false, skip in-app (but still send security)
          if (category === 'leaveUpdates' && prefs.leaveUpdates === false) return true;
          if (category === 'attendanceAlerts' && prefs.attendanceAlerts === false) return true;
          if (category === 'systemAlerts' && prefs.systemAlerts === false) return true;
          // If email pref is false, skip email
          if (prefs.email === false) recipientEmail = null;
          // If inApp pref is false, skip creating notification
          if (prefs.inApp === false) {
            // Still send email if applicable
            await _sendEmail(recipientEmail, title, message);
            return true;
          }
        }
      } catch(prefErr) {
        // Don't block notification on pref check error
      }
    }

    // 1. Create in-app notification
    await Notification.create({ tenantId, employeeId, title, message, type, isRead: false });

    // 2. Send email
    await _sendEmail(recipientEmail, title, message);

    return true;
  } catch (err) {
    console.error('Failed to dispatch notification:', err);
    return false;
  }
}

async function _sendEmail(recipientEmail, title, message) {
  const transporter = getTransporter();
  if (transporter && recipientEmail) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipientEmail,
        subject: title,
        text: message,
        html: `<div style="font-family:sans-serif;padding:20px"><h3>${title}</h3><p>${message}</p><hr><small>HRMS Notification</small></div>`
      });
    } catch(mailErr) {
      console.error('SMTP send failed, falling back to log:', mailErr.message);
      _logEmail(recipientEmail, title, message);
    }
  } else {
    _logEmail(recipientEmail, title, message);
  }
}

function _logEmail(to, subject, body) {
  console.log(`\n=================== [EMAIL OUTBOX] ===================`);
  console.log(`To: ${to || 'Employee (no email provided)'}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
  console.log(`======================================================\n`);
}

module.exports = { sendNotification };
