const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

console.log('SMTP Config:', { SMTP_HOST, SMTP_PORT, SMTP_USER, EMAIL_FROM });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

async function main() {
  console.log('Sending test email...');
  const info = await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to: SMTP_USER,
    subject: 'Test Email Mess Management',
    text: 'This is a test email.',
  });
  console.log('Email sent successfully!', info.messageId);
}

main().catch((err) => {
  console.error('Email sending failed:', err);
});
