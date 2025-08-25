import { Router } from 'express'

const router = Router()

// GET /api/deals/live (PUBLIC)
router.get('/deals/live', async (_req, res) => {
  try {
    // TODO: replace with real source; keep JSON shape stable
    const items = []
    const updatedAt = new Date().toISOString()
    res.status(200).type('application/json').json({ items, updatedAt })
  } catch (e: any) {
    console.error('[deals-live] fail', e?.message || e)
    res.status(502).type('application/json').json({ error: 'bad_upstream', detail: 'upstream_not_json' })
  }
})

// Debug helpers (PUBLIC)
router.get('/_debug/deals-ping', (_req, res) => {
  res.status(200).type('application/json').json({ ok: true, ts: Date.now() })
})

router.get('/_debug/deals-echo', (req, res) => {
  res.status(200).type('application/json').json({ ok: true, url: req.originalUrl, headers: req.headers, query: req.query })
})

export default router