import { SplitPanel } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LapsTable } from './lapsTable';

const RaceDetailsPanel = ({ race }) => {
  const { t } = useTranslation();

  const tableSettings = {
    variant: 'full-page',
  };
  // JSX
  return (
    <SplitPanel
      header="Laps"
      i18nStrings={{
        preferencesTitle: 'Split panel preferences',
        preferencesPositionLabel: 'Split panel position',
        preferencesPositionDescription: 'Choose the default split panel position for the service.',
        preferencesPositionSide: 'Side',
        preferencesPositionBottom: 'Bottom',
        preferencesConfirm: 'Confirm',
        preferencesCancel: 'Cancel',
        closeButtonAriaLabel: 'Close panel',
        openButtonAriaLabel: 'Open panel',
        resizeHandleAriaLabel: 'Resize split panel',
      }}
    >
      <LapsTable race={race} tableSettings={tableSettings} />
    </SplitPanel>
  );
};

export { RaceDetailsPanel };
