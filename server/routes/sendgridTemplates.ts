
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// Get SendGrid templates catalog
router.get('/templates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    
    if (!SENDGRID_API_KEY) {
      return res.status(500).json({ 
        error: 'SendGrid API key not configured',
        templates: []
      });
    }

    // Call SendGrid API to get templates
    const response = await fetch('https://api.sendgrid.com/v3/templates?generations=dynamic', {
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sg-templates] API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Failed to fetch SendGrid templates',
        details: errorText
      });
    }

    const data = await response.json();
    
    // Transform to our format
    const templates = (data.templates || []).map((template: any) => ({
      id: template.id,
      name: template.name,
      updated_at: template.updated_at,
      versions: (template.versions || []).map((version: any) => ({
        id: version.id,
        name: version.name,
        active: version.active === 1
      }))
    }));

    console.log(`[sg-templates] Retrieved ${templates.length} SendGrid templates`);

    res.json({
      templates,
      total: templates.length,
      environment: {
        SG_TEMPLATE_PRICE_DROP_ID: process.env.SG_TEMPLATE_PRICE_DROP_ID || null,
        SG_TEMPLATE_WELCOME_ID: process.env.SG_TEMPLATE_WELCOME_ID || null,
        SG_TEMPLATE_PASSWORD_RESET_ID: process.env.SG_TEMPLATE_PASSWORD_RESET_ID || null
      }
    });

  } catch (error) {
    console.error('[sg-templates] Error fetching templates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SendGrid templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
