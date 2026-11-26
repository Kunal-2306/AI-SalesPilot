export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  return secret || 'salespilot-dev-secret-local-only';
}
