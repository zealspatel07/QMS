// server/utils/emailService.js
const nodemailer = require('nodemailer');

let cachedTransporter = null;
let cachedSettings = null;

/**
 * Get email transporter (cached)
 */
async function getTransporter(db) {
  // Check if we need to refresh (every request in case settings changed)
  try {
    const conn = await db.getConnection();
    const [[settings]] = await conn.query(
      `SELECT smtp_host, smtp_port, smtp_user FROM app_settings LIMIT 1`
    );
    conn.release();

    if (!settings || !settings.smtp_host) {
      throw new Error('Email settings not configured');
    }

    return nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port || 587),
      secure: parseInt(settings.smtp_port || 587) === 465,
      auth: {
        user: settings.smtp_user,
        pass: process.env.SMTP_PASS
      }
    });
  } catch (err) {
    console.error('Failed to create transporter:', err.message);
    throw err;
  }
}

/**
 * Send email
 */
async function sendEmail(db, options) {
  try {
    const transporter = await getTransporter(db);
    
    const conn = await db.getConnection();
    const [[settings]] = await conn.query(
      `SELECT smtp_from FROM app_settings LIMIT 1`
    );
    conn.release();

    const mailOptions = {
      from: options.from || settings.smtp_from || process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html || options.text,
      text: options.text
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✓ Email sent:', result.messageId);
    return result;
  } catch (err) {
    console.error('Failed to send email:', err.message);
    throw err;
  }
}

/**
 * Send notification to CEO
 */
async function sendCEOAlert(db, title, message, details = {}) {
  try {
    const conn = await db.getConnection();
    const [[settings]] = await conn.query(
      `SELECT ceo_email, company_name FROM app_settings LIMIT 1`
    );
    conn.release();

    if (!settings || !settings.ceo_email) {
      console.warn('CEO email not configured, skipping alert');
      return;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
          ⚠️ ${title}
        </h2>
        
        <p style="margin: 15px 0; font-size: 16px;">
          ${message}
        </p>
        
        ${details.po_number ? `<p><strong>PO Number:</strong> ${details.po_number}</p>` : ''}
        ${details.vendor ? `<p><strong>Vendor:</strong> ${details.vendor}</p>` : ''}
        ${details.delay_days ? `<p><strong>Delay:</strong> ${details.delay_days} days</p>` : ''}
        ${details.timestamp ? `<p><strong>Reported At:</strong> ${new Date(details.timestamp).toLocaleString()}</p>` : ''}
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        
        <p style="color: #666; font-size: 12px;">
          This is an automated alert from ${settings.company_name}. 
          Please log in to the system for more details.
        </p>
      </div>
    `;

    await sendEmail(db, {
      to: settings.ceo_email,
      subject: `⚠️ ${title} - ${settings.company_name}`,
      html: htmlContent
    });

    return true;
  } catch (err) {
    console.error('Failed to send CEO alert:', err.message);
    // Don't throw - let the main operation continue even if email fails
    return false;
  }
}

module.exports = {
  getTransporter,
  sendEmail,
  sendCEOAlert
};
