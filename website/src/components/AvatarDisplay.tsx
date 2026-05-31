import Avatar from '@vierweb/avataaars';
import React from 'react';
import defaultAvatar from '../assets/defaultAvatar.svg';
import { resolveAvatarRender } from './avatarRender';

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
 * - Renders the avataaars Avatar for a configured racer (with hatColor defaulted to hairColor).
 * - Renders the default DeepRacer helmet ("Stig") when unconfigured or the Helmet top is chosen.
 *
 * Used in: profile page header, top navigation, and anywhere else an avatar is shown.
 */
export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  avatarConfig,
  size = 40,
  avatarStyle = 'Circle',
}) => {
  const render = resolveAvatarRender(parseConfig(avatarConfig));

  if (render.useDefault) {
    // No config, or the "Helmet" top → the default DeepRacer helmet ("Stig"), matching DRoA.
    return (
      <img src={defaultAvatar} alt="Default racer avatar" style={{ width: size, height: size }} />
    );
  }

  return (
    <Avatar avatarStyle={avatarStyle} style={{ width: size, height: size }} {...render.config} />
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
      return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}
