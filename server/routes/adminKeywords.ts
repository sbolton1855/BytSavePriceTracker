
import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const router = express.Router();

const getConfigPath = () => join(__dirname, '..', 'config', 'deal_keywords.json');

// GET keyword config
router.get('/admin/keywords', (req, res) => {
  try {
    const configPath = getConfigPath();
    const configFile = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configFile);
    res.json(config);
  } catch (error) {
    console.error('[ERROR] Failed to read keyword config:', error);
    res.status(500).json({ error: 'Failed to read keyword configuration' });
  }
});

// PUT update keyword config
router.put('/admin/keywords', (req, res) => {
  try {
    const { liveDeals, trendingNow } = req.body;
    
    // Validate input
    if (!Array.isArray(liveDeals) || !Array.isArray(trendingNow)) {
      return res.status(400).json({ error: 'liveDeals and trendingNow must be arrays' });
    }
    
    const config = { liveDeals, trendingNow };
    const configPath = getConfigPath();
    
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    res.json({ message: 'Keyword configuration updated successfully', config });
  } catch (error) {
    console.error('[ERROR] Failed to update keyword config:', error);
    res.status(500).json({ error: 'Failed to update keyword configuration' });
  }
});

export default router;
