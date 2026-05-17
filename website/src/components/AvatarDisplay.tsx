import Avatar from 'avataaars';
import React from 'react';

/**
 * Generic person silhouette SVG — used when the user has not configured an avatar.
 * Renders a neutral grey head-and-shoulders outline inside a circle.
 */
const PlaceholderSilhouette: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="No avatar configured"
  >
    <circle cx="32" cy="32" r="31" fill="#e9ebed" stroke="#b6bec9" strokeWidth="1" />
    <circle cx="32" cy="24" r="10" fill="#b6bec9" />
    <ellipse cx="32" cy="52" rx="18" ry="14" fill="#b6bec9" />
  </svg>
);

export interface AvatarDisplayProps {
  /** JSON string of avatar config, a parsed object, or null/undefined if unconfigured */
  avatarConfig?: string | Record<string, string> | null;
  /** Size in pixels (default: 40) */
  size?: number;
  /** Avatar style — 'Circle' for solid background, 'Transparent' for no background */
  avatarStyle?: 'Circle' | 'Transparent';
}

/**
 * Shared avatar display component.
 *
 * - If `avatarConfig` is provided (non-null, non-empty), renders the avataaars Avatar.
 * - Otherwise renders a neutral grey silhouette placeholder.
 *
 * Used in: profile page header, top navigation, and anywhere else an avatar is shown.
 */
export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  avatarConfig,
  size = 40,
  avatarStyle = 'Circle',
}) => {
  const parsed = parseConfig(avatarConfig);

  if (!parsed) {
    return <PlaceholderSilhouette size={size} />;
  }

  return (
    <Avatar
      avatarStyle={avatarStyle}
      style={{ width: size, height: size }}
      {...(parsed as Record<string, string>)}
    />
  );
};

/** Parse an avatar config from various input formats */
function parseConfig(
  raw: string | Record<string, string> | null | undefined
): Record<string, string> | null {
  if (!raw) return null;

  // Already an object
  if (typeof raw === 'object') {
    return Object.keys(raw).length > 0 ? raw : null;
  }

  // JSON string (possibly double-encoded)
  if (typeof raw === 'string') {
    try {
      let parsed = JSON.parse(raw);
      // Handle double-encoded JSON
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  return null;
}

export { PlaceholderSilhouette };
