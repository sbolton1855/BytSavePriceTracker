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
import express from 'express';
import { Request, Response } from 'express';

const router = express.Router();

// Debug endpoints (temporary)
router.get('/_debug/deals-echo', (req: Request, res: Response) => {
  console.log('[DEBUG] /api/deals/_debug/deals-echo hit');
  res.status(200).type('application/json').json({
    ok: true,
    headers: req.headers,
    query: req.query
  });
});

router.get('/_debug/deals-ping', (req: Request, res: Response) => {
  console.log('[DEBUG] /api/deals/_debug/deals-ping hit');
  res.status(200).type('application/json').json({
    ok: true,
    ts: Date.now()
  });
});

// Live deals endpoint - PUBLIC, no auth required
router.get('/live', async (req: Request, res: Response) => {
  console.log('[deals-live] hit', req.originalUrl);
  
  try {
    // For now, return empty deals - we can connect to Amazon API later
    const items: any[] = [];
    const updatedAt = new Date().toISOString();
    
    res.status(200).type('application/json').json({
      items,
      updatedAt
    });
  } catch (error: any) {
    console.error('[deals-live] error:', error);
    res.status(502).type('application/json').json({
      error: 'bad_upstream',
      detail: error.message,
      hint: 'upstream_not_json'
    });
  }
});

export default router;
