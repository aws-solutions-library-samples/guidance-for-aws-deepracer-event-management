import { SpaceBetween } from '@cloudscape-design/components';
import Link from '@cloudscape-design/components/link';
import * as React from 'react';

/**
 * Props interface for EventLinksButtons component
 */
interface EventLinksButtonsProps {
  /** URL for the links */
  href: string;
  /** Text for the primary link */
  linkTextPrimary: string;
  /** Text for the external link */
  linkTextExternal: string;
}

/**
 * EventLinksButtons component that displays primary and external link buttons
 * @param props - Component props
 * @returns Rendered link buttons
 */
export const EventLinksButtons = ({ 
  href, 
  linkTextPrimary, 
  linkTextExternal 
}: EventLinksButtonsProps): JSX.Element => {
  return (
    <div>
      <Link href={href} variant="primary">
        {linkTextPrimary}
      </Link>
      <SpaceBetween size="xs" />
      <Link external externalIconAriaLabel="Opens in a new tab" href={href}>
        {linkTextExternal}
      </Link>
    </div>
  );
};
