import { requireAuth } from '../middleware/auth.ts';
import { db } from '../db/schema.ts';
import { json } from '../lib/router.ts';

export async function getColours(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const colours = db
    .prepare<{ user_id: number; colour_hex: string }, []>('SELECT user_id, colour_hex FROM user_colours')
    .all();

  return json(colours);
}
