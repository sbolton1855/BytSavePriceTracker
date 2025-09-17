
import express from 'express';
import { storage } from '../storage';
import { requireAdmin } from '../middleware/requireAdmin';

const router = express.Router();

// Get all global config
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const configs = await storage.getAllGlobalConfig();
    res.json({ success: true, configs });
  } catch (error) {
    console.error('❌ Error fetching global config:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch configuration' });
  }
});

// Update cooldown hours
router.post('/config/cooldown', requireAdmin, async (req, res) => {
  try {
    const { hours } = req.body;
    
    if (!hours || isNaN(parseInt(hours)) || parseInt(hours) < 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid hours value. Must be a positive number.' 
      });
    }

    await storage.setGlobalConfig('cooldown_hours', String(parseInt(hours)));
    
    console.log(`✅ Admin updated global cooldown to ${hours} hours`);
    res.json({ success: true, message: `Cooldown updated to ${hours} hours` });
  } catch (error) {
    console.error('❌ Error updating cooldown config:', error);
    res.status(500).json({ success: false, error: 'Failed to update cooldown configuration' });
  }
});

// Set any global config value
router.post('/config/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!key || !value) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both key and value are required' 
      });
    }

    await storage.setGlobalConfig(key, String(value));
    
    console.log(`✅ Admin updated global config: ${key} = ${value}`);
    res.json({ success: true, message: `Configuration ${key} updated` });
  } catch (error) {
    console.error(`❌ Error updating config ${req.params.key}:`, error);
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

export default router;
