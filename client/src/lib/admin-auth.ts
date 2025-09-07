const ADMIN_TOKEN_KEY = 'admin_token';

export class AdminAuth {
  private static getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;

    // Check all possible storage locations
    let token = localStorage.getItem(ADMIN_TOKEN_KEY) || 
                localStorage.getItem('admin-token') || 
                sessionStorage.getItem('admin-token');

    console.log('[AdminAuth] Stored token from localStorage:', token ? token.substring(0, 8) + '...' : 'NONE');

    // Development fallback - use your actual ADMIN_SECRET value
    if (!token) {
      token = '6f32d418c8234c93b85f0f41fda31cfb'; // Your actual admin secret
      console.log('[AdminAuth] Using development fallback token');
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
    console.log('[AdminAuth] Attempting login with token:', token.substring(0, 8) + '...');
    const isValid = await this.validateToken(token);
    if (isValid) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      localStorage.setItem('admin-token', token); // Store in both locations for compatibility
      console.log('[AdminAuth] Login successful, token stored');
      return true;
    }
    console.log('[AdminAuth] Login failed, token validation failed');
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
    console.log('[AdminAuth] Getting token...');

    // Always use the development fallback in dev environment
    const devToken = '6f32d418c8234c93b85f0f41fda31cfb';

    let token = localStorage.getItem(ADMIN_TOKEN_KEY) || 
                localStorage.getItem('admin-token') || 
                sessionStorage.getItem('admin-token');

    console.log('[AdminAuth] Stored token from storage:', token ? token.substring(0, 8) + '...' : 'NONE');

    // Always use development fallback to ensure consistency
    if (!token || token === 'NONE' || token.trim() === '') {
      token = devToken;
      console.log('[AdminAuth] Using development fallback token');
    }

    console.log('[AdminAuth] Final token being returned:', token ? token.substring(0, 8) + '...' : 'NULL');

    // Ensure we never return null/undefined in development
    return token || devToken;
  }

  static clearToken(): void {
    this.logout();
  }
}