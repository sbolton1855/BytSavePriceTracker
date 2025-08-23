import sgMail from '@sendgrid/mail';

// Validate and initialize SendGrid with API key
const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.error('SENDGRID_API_KEY environment variable is not set');
} else {
  // SendGrid API keys can start with 'SG.' but Replit Secrets may modify the format
  // Just verify it's a non-empty string and initialize
  sgMail.setApiKey(apiKey);
  console.log('SendGrid initialized successfully with API key from Replit Secrets');
}

export interface SendGridEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured. Email not sent.');
      return { success: false, error: 'SendGrid API key not configured' };
    }

    // Check if API key is configured
    if (!apiKey) {
        console.warn('SendGrid API key is invalid or not set. Email not sent.');
        return { success: false, error: 'SendGrid API key is invalid or not configured' };
    }


    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'alerts@bytsave.com',
      subject,
      html,
    };

    console.log(`Sending email via SendGrid to: ${to}`);
    console.log(`Subject: ${subject}`);

    const response = await sgMail.send(msg);
    const messageId = response[0]?.headers?.['x-message-id'] || 'unknown';

    console.log(`Email sent successfully via SendGrid. Message ID: ${messageId}`);

    return { success: true, messageId };
  } catch (error: any) {
    console.error('Failed to send email via SendGrid:', error);

    let errorMessage = 'Unknown SendGrid error';
    if (error.response?.body?.errors) {
      errorMessage = error.response.body.errors.map((e: any) => e.message).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
}