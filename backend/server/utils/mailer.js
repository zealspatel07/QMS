//server/utils/mailer.js 

const nodemailer = require("nodemailer");
const db = require("../db");

async function getSettings() {
  const conn = await db.getConnection();
  try {
    const [[row]] = await conn.query(
      "SELECT * FROM app_settings WHERE id = 1"
    );
    return row;
  } finally {
    conn.release();
  }
}

async function sendMail({ to, subject, html, attachments }) {
  const settings = await getSettings();

  if (!settings.smtp_host || !settings.smtp_user) {
    throw new Error("SMTP not configured");
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port),
    secure: Number(settings.smtp_port) === 465,
    auth: {
      user: settings.smtp_user,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter.sendMail({
    from: settings.smtp_from || settings.smtp_user,
    to,
    subject,
    html,
    attachments,
  });
}

module.exports = { sendMail };