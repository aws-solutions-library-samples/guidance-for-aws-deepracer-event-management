import { SpaceBetween } from '@cloudscape-design/components';
import Link from '@cloudscape-design/components/link';
import * as React from 'react';

export const EventLinksButtons = (props) => {
  return (
    <div>
      <Link href={props.href} variant="primary">
        {props.linkTextPrimary}
      </Link>
      <SpaceBetween size="xs" />
      <Link external externalIconAriaLabel="Opens in a new tab" href={props.href}>
        {props.linkTextExternal}
      </Link>
    </div>
  );
};
