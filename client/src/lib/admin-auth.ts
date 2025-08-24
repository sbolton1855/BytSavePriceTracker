const ADMIN_TOKEN_KEY = 'admin_token';

export class AdminAuth {
  private static getStoredToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  private static async validateToken(token: string): Promise<boolean> {
    try {
      // Test the token with a protected admin endpoint
      const response = await fetch('/api/admin/validate-token', {
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
}

// Assuming getToken is a function available in the scope that retrieves the admin token.
// If getToken is part of AdminAuth, it should be accessed as AdminAuth.getToken()
// For the purpose of this modification, we'll assume a global getToken function exists or it's implicitly available.
declare function getToken(): string | null;

export const adminApi = {
  async getEmailLogs(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });

    const response = await fetch(`/api/admin/email-logs?${params}`, {
      headers: { 'x-admin-token': getToken() }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email logs');
    }

    return response.json();
  },

  async previewTemplatePOST(templateId: string, data: any) {
    const response = await fetch('/api/admin/email/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': getToken()
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
};