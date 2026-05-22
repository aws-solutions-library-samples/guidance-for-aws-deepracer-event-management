/**
 * AppSync returns the avatar config as an `AWSJSON` scalar, which can
 * arrive either as an object already parsed by Amplify or as a
 * double-encoded JSON string (legacy storage path). Normalise both
 * shapes into a plain key/value record the avataaars `Avatar`
 * component will accept.
 *
 * Returns `null` for any input that doesn't yield a plain object —
 * callers fall back to a flag-only display in that case.
 */
export function parseAvatarConfig(raw: unknown): Record<string, string> | null {
  if (!raw) return null;
  try {
    let parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, string>)
      : null;
  } catch {
    return null;
  }
}
