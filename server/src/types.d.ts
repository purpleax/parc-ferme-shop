export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: import('./types.js').AuthUser;
    }
  }
}
