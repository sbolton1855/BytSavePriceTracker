import { sendEmail as sendGridEmail } from './email/sendgridService';
import { db } from './db';
import { emailLogs } from '@shared/schema';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  productId?: number;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const result = await sendGridEmail(options.to, options.subject, options.html);

    if (result.success) {
      console.log(`Email sent successfully via SendGrid. Message ID: ${result.messageId}`);

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
    } else {
      console.error('SendGrid email failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}