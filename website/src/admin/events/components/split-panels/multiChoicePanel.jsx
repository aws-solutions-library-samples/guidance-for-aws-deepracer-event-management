import { SplitPanel } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';

const MultiChoicePanel = ({ events, i18nStrings, i18Header }) => {
  const { t } = useTranslation();

  // JSX
  return (
    <SplitPanel
      header={`${events.length} ${i18Header}`}
      i18nStrings={{
        ...i18nStrings,
      }}
    >
      {t('events.split-panel.multi-choice-text')}
    </SplitPanel>
  );
};

export { MultiChoicePanel };
