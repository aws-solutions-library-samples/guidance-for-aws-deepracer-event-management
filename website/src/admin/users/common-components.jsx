import { HelpPanel } from '@cloudscape-design/components';
import React from 'react';

export const ToolsFooter = () => <></>;

export const ToolsContent = () => (
  <HelpPanel footer={ToolsFooter} header={<h2>User list</h2>}>
    <p>View all of the users in DREM.</p>
  </HelpPanel>
);
