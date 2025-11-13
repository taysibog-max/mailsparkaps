import { getAuth } from './firestoreAdmin';

export interface AuthResult {
  uid: string;
}

export async function requireUser(req: any): Promise<AuthResult> {
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('Unauthorized');
  const auth = getAuth();
  const decoded = await auth.verifyIdToken(token);
  return { uid: decoded.uid };
}




