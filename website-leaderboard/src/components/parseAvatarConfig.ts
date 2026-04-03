export function parseAvatarConfig(raw: any): Record<string, string> | null {
  if (!raw) return null;
  try {
    let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Handle AWSJSON double-encoding
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
