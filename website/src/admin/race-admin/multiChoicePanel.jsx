import { SplitPanel } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';

const MultiChoicePanel = ({ races }) => {
  const { t } = useTranslation();

  // JSX
  return (
    <SplitPanel
      header={`${races.length} races selected`}
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
      TODO Display calculated summary metrics. Total laps / Total resets / Avg resets per lap / Avg
      # of laps per race / avg lap time / fastest lap / slowest lap
    </SplitPanel>
  );
};

export { MultiChoicePanel };
