const ADMIN_TOKEN_KEY = 'admin_token';

export class AdminAuth {
  private static getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    // Check all possible storage locations
    let token = localStorage.getItem(ADMIN_TOKEN_KEY) || 
                localStorage.getItem('admin-token') || 
                sessionStorage.getItem('admin-token');
    
    // Development fallback - use your actual ADMIN_SECRET value
    if (!token && process.env.NODE_ENV === 'development') {
      token = '6f32d418c8234c93b85f0f41fda31cfb'; // Your actual admin secret
    }
    
    return token;
  }

  private static async validateToken(token: string): Promise<boolean> {
    try {
      console.log('[AdminAuth] Validating token:', token ? `${token.substring(0, 8)}...` : 'EMPTY');
      // Test the token with email-templates endpoint (which we know works)
      const response = await fetch('/api/admin/email-templates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('[AdminAuth] Token validation response:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[AdminAuth] Validation error:', errorText);
      }
      return response.ok;
    } catch (error) {
      console.error('[AdminAuth] Token validation failed:', error);
      return false;
    }
  }

  static async login(token: string): Promise<boolean> {
    const isValid = await this.validateToken(token);
    if (isValid) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      localStorage.setItem('admin-token', token); // Store in both locations for compatibility
      return true;
    }
    return false;
  }

  static logout(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem('admin-token');
    sessionStorage.removeItem('admin-token');
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;
    return await this.validateToken(token);
  }

  static getToken(): string | null {
    const token = this.getStoredToken();
    console.log('[AdminAuth] Retrieved token:', token ? token.substring(0, 8) + '...' : 'NONE');
    return token;
  }

  static clearToken(): void {
    this.logout();
  }
}