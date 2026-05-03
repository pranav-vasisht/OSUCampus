import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;

export const SOURCES_BUCKET = 'sources';

export function sanitizeStorageFileName(name) {
  return name.replace(/[/\\]/g, '_').slice(0, 200) || 'file';
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const redirectTo = new URL(import.meta.env.BASE_URL || '/', window.location.origin).href;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchUserDocuments(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_documents')
    .select('id, user_id, name, source_type, text_content, youtube_url, storage_path, mime_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertUserDocument(row) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('user_documents').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteUserDocumentRow(id, userId) {
  if (!supabase) return;
  const { error } = await supabase.from('user_documents').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function uploadSourceBlob(userId, docId, fileName, blob, mimeType) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const safeName = sanitizeStorageFileName(fileName);
  const path = `${userId}/${docId}/${safeName}`;
  const { error } = await supabase.storage.from(SOURCES_BUCKET).upload(path, blob, {
    contentType: mimeType || blob.type || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function downloadSourceFile(storagePath) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.storage.from(SOURCES_BUCKET).download(storagePath);
  if (error) throw error;
  return data;
}

export async function deleteSourceFile(storagePath) {
  if (!supabase) return;
  const { error } = await supabase.storage.from(SOURCES_BUCKET).remove([storagePath]);
  if (error) throw error;
}
