
import nodemailer from 'nodemailer';
import { db } from './db';
import { emailLogs } from '@shared/schema';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  productId?: number;
}

// Configure email transporter
function createTransporter() {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email credentials not configured. Email not sent.');
      return false;
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    console.log(`Sending email to: ${options.to}`);
    console.log(`Subject: ${options.subject}`);

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully. Message ID: ${info.messageId}`);

    // Log the sent email
    try {
      await db.insert(emailLogs).values({
        recipientEmail: options.to,
        productId: options.productId || null,
        subject: options.subject,
        previewHtml: options.html,
        sentAt: new Date(),
      });
      console.log('Email log saved to database');
    } catch (logError) {
      console.error('Failed to log email to database:', logError);
      // Don't fail the email send if logging fails
    }

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
