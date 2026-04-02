import { Role } from '../generated/prisma/enums';

declare global {
  namespace Express {
    interface Request {
      context?: {
        user_id: string;
        tenant_id: string | null;
        role: Role;
      };
    }
  }
}

export {};
