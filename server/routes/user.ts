
import express from 'express';
import { db } from '../db';
import { trackedProducts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Schema for cooldown update request
const cooldownUpdateSchema = z.object({
  email: z.string().email(),
  cooldownHours: z.number().min(1).max(168) // 1 hour to 1 week
});

// POST /api/user/cooldown - Update user's cooldown preference
router.post('/cooldown', async (req, res) => {
  try {
    const validation = cooldownUpdateSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.format()
      });
    }

    const { email, cooldownHours } = validation.data;

    // Update cooldown_hours for all tracked products by this user
    const updateResult = await db
      .update(trackedProducts)
      .set({ cooldownHours })
      .where(eq(trackedProducts.email, email));

    console.log(`✅ Updated cooldown to ${cooldownHours}h for user: ${email}`);

    res.json({
      success: true,
      message: `Cooldown period updated to ${cooldownHours} hours`,
      updatedCount: updateResult.rowCount || 0
    });

  } catch (error) {
    console.error('Error updating cooldown:', error);
    res.status(500).json({
      error: 'Failed to update cooldown settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/user/preferences - Get user preferences
router.get('/preferences', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    // Get user's current cooldown setting from any tracked product
    const userTracking = await db
      .select({
        cooldownHours: trackedProducts.cooldownHours
      })
      .from(trackedProducts)
      .where(eq(trackedProducts.email, email))
      .limit(1);

    const cooldownHours = userTracking[0]?.cooldownHours || 48; // Default to 48 hours

    res.json({
      success: true,
      preferences: {
        cooldownHours
      }
    });

  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({
      error: 'Failed to fetch preferences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
