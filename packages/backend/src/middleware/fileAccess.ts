import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt';

/**
 * File access verification middleware for uploaded files.
 *
 * Security model:
 * - Uploaded files are public images (logos, service photos) displayed on public pages
 * - Tenant namespacing + UUID filenames prevent enumeration
 * - For authenticated requests: verifies the requesting user's tenant_id matches
 *   the tenant_id prefix in the file path (returns 403 on mismatch)
 * - For unauthenticated requests: allows access (public pages need to show images)
 */
export function fileAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract the file path from the URL (e.g., /tenant-123/uuid.jpg)
  const filePath = req.path.replace(/^\//, ''); // remove leading slash
  const pathSegments = filePath.split('/');

  // File path must have at least tenant_id/filename
  if (pathSegments.length < 2 || !pathSegments[0]) {
    res.status(403).json({ error: 'Acesso negado ao arquivo' });
    return;
  }

  const pathTenantId = pathSegments[0];

  // Check if request has an Authorization header (authenticated user)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyJwt(token);
      const userTenantId = payload.tenant_id ?? payload.user_id;

      if (userTenantId !== pathTenantId) {
        res.status(403).json({ error: 'Acesso negado ao arquivo' });
        return;
      }
    } catch {
      // Invalid token — treat as unauthenticated (allow public access)
    }
  }

  // Allow access: either unauthenticated (public page) or tenant matches
  next();
}
