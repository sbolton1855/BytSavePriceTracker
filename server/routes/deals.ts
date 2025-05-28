import express from 'express';
import { searchProducts } from '../amazonApi';
import { logApiError } from '../errorController';

const router = express.Router();

router.get('/products/deals', async (req, res) => {
  try {
    const searchTerm = req.query.q || 'deals';
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const deals = await searchProducts(searchTerm as string, limit);
    
    if (deals.length === 0) {
      return res.status(404).json({ message: 'No deals found' });
    }

    res.json(deals);
  } catch (error) {
    console.error('Failed to fetch deals:', error);
    
    if (error instanceof Error) {
      await logApiError('SEARCH', 'API_FAILURE', error.message);
      res.status(500).json({ error: error.message });
    } else {
      await logApiError('SEARCH', 'API_FAILURE', 'Unknown error occurred');
      res.status(500).json({ error: 'Failed to fetch deals' });
    }
  }
});

export default router; 