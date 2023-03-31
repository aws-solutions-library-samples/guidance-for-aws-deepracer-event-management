import { SplitPanel } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';

const EmptyPanel = ({ i18nStrings, i18Header }) => {
  const { t } = useTranslation();

  // JSX
  return (
    <SplitPanel header={`0 ${i18Header}`} i18nStrings={{ ...i18nStrings }}>
      {t('events.split-panel.empty')}
    </SplitPanel>
  );
};

export { EmptyPanel };
