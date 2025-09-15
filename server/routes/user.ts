
import express from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Schema for cooldown update request
const cooldownUpdateSchema = z.object({
  email: z.string().email(),
  cooldownHours: z.number().min(1).max(168) // 1 hour to 1 week
});

// Schema for price drop alerts toggle request
const priceDropAlertsSchema = z.object({
  email: z.string().email(),
  enabled: z.boolean()
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

    // Update cooldown_hours for the user
    const updateResult = await db
      .update(users)
      .set({ cooldownHours })
      .where(eq(users.email, email));

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

// POST /api/user/price-drop-alerts - Toggle price drop alerts
router.post('/price-drop-alerts', async (req, res) => {
  try {
    const validation = priceDropAlertsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error.format()
      });
    }

    const { email, enabled } = validation.data;

    // Update priceDropAlertsEnabled for the user
    const updateResult = await db
      .update(users)
      .set({ priceDropAlertsEnabled: enabled })
      .where(eq(users.email, email));

    console.log(`✅ Updated price drop alerts to ${enabled} for user: ${email}`);

    res.json({
      success: true,
      message: `Price drop alerts ${enabled ? 'enabled' : 'disabled'}`,
      updatedCount: updateResult.rowCount || 0
    });

  } catch (error) {
    console.error('Error updating price drop alerts:', error);
    res.status(500).json({
      error: 'Failed to update price drop alerts setting',
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

    // Get user's current settings from users table
    const user = await db
      .select({
        cooldownHours: users.cooldownHours,
        priceDropAlertsEnabled: users.priceDropAlertsEnabled
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const cooldownHours = user[0]?.cooldownHours || 48; // Default to 48 hours
    const priceDropAlertsEnabled = user[0]?.priceDropAlertsEnabled ?? true; // Default to true

    res.json({
      success: true,
      preferences: {
        cooldownHours,
        priceDropAlertsEnabled
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
