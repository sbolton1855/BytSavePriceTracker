
import { db } from '../db';
import { passwordResetTokens } from '@shared/schema';
import { lt } from 'drizzle-orm';

// Clean up expired password reset tokens
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, new Date()));
    
    console.log(`Cleaned up expired password reset tokens`);
    return result.rowCount || 0;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return 0;
  }
}

// Schedule token cleanup every hour
export function scheduleTokenCleanup() {
  setInterval(async () => {
    try {
      const cleanedCount = await cleanupExpiredTokens();
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired password reset tokens`);
      }
    } catch (error) {
      console.error('Scheduled token cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // Run every hour

  console.log('📅 Password reset token cleanup scheduled');
}
