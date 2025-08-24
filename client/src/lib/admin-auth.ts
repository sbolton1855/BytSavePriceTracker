
const ADMIN_TOKEN_KEY = 'admin_token';

export class AdminAuth {
  private static getStoredToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  private static async validateToken(token: string): Promise<boolean> {
    try {
      // Test the token with a protected admin endpoint
      const response = await fetch('/api/admin/auth/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      return response.ok;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  static async login(token: string): Promise<boolean> {
    const isValid = await this.validateToken(token);
    if (isValid) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      return true;
    }
    return false;
  }

  static logout(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;
    return await this.validateToken(token);
  }

  static getToken(): string | null {
    return this.getStoredToken();
  }

  static clearToken(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export const adminApi = {
  async getEmailTemplates() {
    const response = await fetch('/api/admin/templates', {
      headers: { 'x-admin-token': AdminAuth.getToken() || '' }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email templates');
    }

    return response.json();
  },

  async previewTemplatePOST(templateId: string, data: any) {
    const response = await fetch('/api/admin/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': AdminAuth.getToken() || ''
      },
      body: JSON.stringify({ templateId, data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[previewTemplatePOST] Failed:', response.status, errorText);
      throw new Error(`Preview failed: ${response.status}`);
    }

    return response.json();
  },

  async sendTestEmailPOST(emailData: { to?: string; email?: string; templateId: string; data: any }) {
    const response = await fetch('/api/admin/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': AdminAuth.getToken() || ''
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sendTestEmailPOST] Failed:', response.status, errorText);
      throw new Error(`Send test email failed: ${response.status}`);
    }

    return response.json();
  },

  async getEmailLogs(filters: { 
    page?: number; 
    pageSize?: number; 
    status?: string; 
    isTest?: string; 
    to?: string; 
    templateId?: string 
  }) {
    const params = new URLSearchParams();

    if (filters.page) params.set('page', filters.page.toString());
    if (filters.pageSize) params.set('pageSize', filters.pageSize.toString());
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.isTest && filters.isTest !== 'all') params.set('isTest', filters.isTest === 'test' ? 'true' : 'false');
    if (filters.to) params.set('to', filters.to);
    if (filters.templateId) params.set('templateId', filters.templateId);

    const response = await fetch(`/api/admin/email-logs?${params}`, {
      headers: { 'x-admin-token': AdminAuth.getToken() || '' }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email logs');
    }

    return response.json();
  },

  async getEmailLogsDebugCounts() {
    const response = await fetch('/api/admin/_debug/email-logs-counts', {
      headers: { 'x-admin-token': AdminAuth.getToken() || '' }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch debug counts');
    }

    return response.json();
  },

  async getEmailHealth() {
    const response = await fetch('/api/admin/_debug/email-health', {
      headers: { 'x-admin-token': AdminAuth.getToken() || '' }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email health');
    }

    return response.json();
  }
};
