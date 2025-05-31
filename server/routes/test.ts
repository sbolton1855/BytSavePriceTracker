import express from 'express';
import { amazonApi } from '../lib/amazonApi';

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await amazonApi.searchProducts(query);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Failed to search products',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 