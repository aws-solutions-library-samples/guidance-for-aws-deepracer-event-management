import { SplitPanel } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const DrSplitPanel = ({ header, children }) => {
  const { t } = useTranslation();
  const i18nStrings = {
    preferencesTitle: t('common.panel.split-panel-preference-title'),
    preferencesPositionLabel: t('common.panel.split-panel-position-label'),
    preferencesPositionDescription: t('common.panel.split-panel-position-description'),
    preferencesPositionSide: t('common.panel.position-side'),
    preferencesPositionBottom: t('common.panel.position-bottom'),
    preferencesConfirm: t('button.confirm'),
    preferencesCancel: t('button.cancel'),
    closeButtonAriaLabel: t('common.panel.close'),
    openButtonAriaLabel: t('common.panel.open'),
    resizeHandleAriaLabel: t('common.panel.split-panel-resize-label'),
  };

  // JSX
  return (
    <SplitPanel header={header} i18nStrings={{ ...i18nStrings }}>
      {children}
    </SplitPanel>
  );
};
