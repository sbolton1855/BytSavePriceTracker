
interface EmailRateLimit {
  email: string;
  lastSent: Date;
  count: number;
  resetTime: Date;
}

const emailRateLimits = new Map<string, EmailRateLimit>();

// Maximum emails per recipient per hour
const MAX_EMAILS_PER_HOUR = 3;

export function canSendEmail(recipientEmail: string): boolean {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const existing = emailRateLimits.get(recipientEmail);
  
  if (!existing) {
    // First email for this recipient
    emailRateLimits.set(recipientEmail, {
      email: recipientEmail,
      lastSent: now,
      count: 1,
      resetTime: new Date(now.getTime() + 60 * 60 * 1000)
    });
    return true;
  }
  
  // Reset if hour has passed
  if (now > existing.resetTime) {
    emailRateLimits.set(recipientEmail, {
      email: recipientEmail,
      lastSent: now,
      count: 1,
      resetTime: new Date(now.getTime() + 60 * 60 * 1000)
    });
    return true;
  }
  
  // Check if under limit
  if (existing.count < MAX_EMAILS_PER_HOUR) {
    existing.count++;
    existing.lastSent = now;
    return true;
  }
  
  console.log(`📧 Rate limit exceeded for ${recipientEmail}: ${existing.count}/${MAX_EMAILS_PER_HOUR} emails this hour`);
  return false;
}

export function recordEmailSent(recipientEmail: string): void {
  const now = new Date();
  const existing = emailRateLimits.get(recipientEmail);
  
  if (existing) {
    existing.lastSent = now;
  }
}

// Clean up old rate limit entries (run periodically)
export function cleanupRateLimits(): void {
  const now = new Date();
  for (const [email, limit] of emailRateLimits.entries()) {
    if (now > limit.resetTime) {
      emailRateLimits.delete(email);
    }
  }
}
