
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('Starting SMTP test...');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS present:', !!process.env.EMAIL_PASS);

async function testSMTP() {
  try {
    // Create transporter with Hostinger settings
    const transporter = nodemailer.createTransporter({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log('Verifying SMTP connection...');
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');

    // Send test email
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'SMTP Test ✅',
      text: 'If you see this, SMTP is working.',
      html: '<p>If you see this, <strong>SMTP is working</strong>.</p>'
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
  } catch (error) {
    console.error('❌ SMTP test failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  }
}

testSMTP();
