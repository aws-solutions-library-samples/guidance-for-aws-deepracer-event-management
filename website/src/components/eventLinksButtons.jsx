import * as React from "react";
import Link from "@cloudscape-design/components/link";
import { SpaceBetween } from '@cloudscape-design/components';

export const EventLinksButtons = (props) => {
  return (
    <div>
      <Link
        href={props.href}
        variant="primary">
        {props.linkTextPrimary}
      </Link>
      <SpaceBetween size="xs" />
      <Link
        external
        externalIconAriaLabel="Opens in a new tab"
        href={props.href}
      >
        {props.linkTextExternal}
      </Link>
    </div>

  );
}
