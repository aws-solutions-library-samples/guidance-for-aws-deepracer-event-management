import Avatar from '@vierweb/avataaars';
import React from 'react';
import defaultAvatar from '../assets/defaultAvatar.svg';

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
 * - Otherwise renders the default DeepRacer helmet avatar.
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
    // No avatar configured → the default DeepRacer helmet ("Stig"), matching DRoA.
    return (
      <img src={defaultAvatar} alt="Default racer avatar" style={{ width: size, height: size }} />
    );
  }

  // @vierweb/avataaars@3 defaults hats to blue; mirror avataaars@2 / DRoA by
  // colouring the hat with the racer's hair colour when one is set.
  const renderConfig =
    parsed.hairColor && !parsed.hatColor ? { ...parsed, hatColor: parsed.hairColor } : parsed;

  return (
    <Avatar
      avatarStyle={avatarStyle}
      style={{ width: size, height: size }}
      {...(renderConfig as Record<string, string>)}
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
