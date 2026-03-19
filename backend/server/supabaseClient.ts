/**
 * Supabase Admin Client
 * Uses service key for server-side operations
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function testConnection(): Promise<boolean> {
  const { error } = await supabase.from('incidents').select('id').limit(1);
  if (error && error.code === '42P01') {
    console.log('⚠️  Tables not found. Run "npm run db:setup" to create them.');
    return false;
  }
  return true;
}
