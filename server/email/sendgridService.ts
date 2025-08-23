
import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

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
