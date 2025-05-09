/**
 * Helper function to check if a given environment variable exists
 */
export function checkEnvVar(envVar: string): boolean {
  const value = process.env[envVar];
  return !!value && value.trim() !== '';
}

/**
 * Helper function to check multiple environment variables
 */
export function checkEnvVars(envVars: string[]): {
  allExist: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  
  for (const envVar of envVars) {
    if (!checkEnvVar(envVar)) {
      missing.push(envVar);
    }
  }
  
  return {
    allExist: missing.length === 0,
    missing
  };
}

/**
 * Helper function to check if Google OAuth credentials are configured
 */
export function hasGoogleOAuthConfig(): boolean {
  return checkEnvVars(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']).allExist;
}

/**
 * Helper function to check available OAuth methods
 */
export function getAvailableOAuthMethods(): { google: boolean } {
  return {
    google: hasGoogleOAuthConfig()
  };
}