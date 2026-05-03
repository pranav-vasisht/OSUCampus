/**
 * Oregon State University email domain check (client-side gate).
 * Allows @oregonstate.edu and subdomains (e.g. @onid.oregonstate.edu).
 * Rejects lookalikes like @fakeoregonstate.edu.
 */
export function isOregonStateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return false;
  const domain = trimmed.slice(at + 1);
  return domain === 'oregonstate.edu' || domain.endsWith('.oregonstate.edu');
}

export function getSessionUserEmail(user) {
  if (!user) return null;
  return user.email ?? user.user_metadata?.email ?? null;
}
