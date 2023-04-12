import { SplitPanel } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';

const EmptyPanel = () => {
  const { t } = useTranslation();

  // JSX
  return (
    <SplitPanel
      header="0 races selected"
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
      Select a race to see its details
    </SplitPanel>
  );
};

export { EmptyPanel };
