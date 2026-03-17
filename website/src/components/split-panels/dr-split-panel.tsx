import { SplitPanel } from '@cloudscape-design/components';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Props interface for DrSplitPanel component
 */
interface DrSplitPanelProps {
  /** Header content for the split panel */
  header: string;
  /** Child elements to render within the split panel */
  children: ReactNode;
}

/**
 * DrSplitPanel component that wraps CloudScape SplitPanel with internationalization
 * @param props - Component props
 * @returns Rendered split panel with i18n strings
 */
export const DrSplitPanel = ({ header, children }: DrSplitPanelProps): JSX.Element => {
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

  return (
    <SplitPanel header={header} i18nStrings={{ ...i18nStrings }}>
      {children}
    </SplitPanel>
  );
};
