import { SpaceBetween } from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';
import {
  ColumnConfigurationOperator,
  FilteringPropertiesOperator,
} from '../../components/tableCarLogsAssetsConfigOperator';
import {
  ColumnConfigurationRacer,
  FilteringPropertiesRacer,
} from '../../components/tableCarLogsAssetsConfigRacer';
import { TableHeader } from '../../components/tableConfig';
import { useStore } from '../../store/store';
import { DeleteAssetModal } from './components/deleteAssetModal';
import { DownloadAssetModal } from './components/downloadAssetModal';

export const CarLogsManagement = ({ isOperatorView = false, onlyDisplayOwnAssets = true }) => {
  const { t } = useTranslation(['translation', 'help-model-carlogs', 'help-admin-model-carlogs']);
  const [columnConfiguration, setColumnConfiguration] = useState(ColumnConfigurationRacer());
  const [filteringProperties, setFilteringProperties] = useState(FilteringPropertiesRacer());
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [state] = useStore();
  const [, dispatch] = useStore();
  const assets = state.assets.assets;
  const isLoading = state.assets.isLoading;

  // based on onlyDisplayOwnAssets select if only the users own assets should be displayed or all available assets
  const assetsToDisplay = onlyDisplayOwnAssets
    ? assets.filter((asset) => asset.sub === Auth.user.attributes.sub)
    : assets;

  const operatorHelpPanel = useMemo(() => {
    return (
      <SimpleHelpPanelLayout
        headerContent={t('header', { ns: 'help-admin-model-carlogs' })}
        bodyContent={t('content', { ns: 'help-admin-model-carlogs' })}
        footerContent={t('footer', { ns: 'help-admin-model-carlogs' })}
      />
    );
  }, [t]);

  const helpPanel = useMemo(() => {
    return (
      <SimpleHelpPanelLayout
        headerContent={t('header', { ns: 'help-model-carlogs' })}
        bodyContent={t('content', { ns: 'help-model-carlogs' })}
        footerContent={t('footer', { ns: 'help-model-carlogs' })}
      />
    );
  }, [t]);

  // based on isOperatorView select if the operator view should be displayed or the racer view
  useEffect(() => {
    if (isOperatorView) {
      setColumnConfiguration(ColumnConfigurationOperator());
      setFilteringProperties(FilteringPropertiesOperator());
      setBreadcrumbs([
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('operator.breadcrumb'), href: '/admin/home' },
        { text: t('models.breadcrumb'), href: '/admin/home' },
        { text: t('models.models.breadcrumb') },
      ]);
      dispatch('UPDATE_HELP_PANEL', {
        isHidden: false,
        content: operatorHelpPanel,
      });
      dispatch('HELP_PANEL_IS_OPEN', false);
    } else {
      setColumnConfiguration(ColumnConfigurationRacer());
      setFilteringProperties(FilteringPropertiesRacer());
      setBreadcrumbs([
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('models.breadcrumb'), href: '/models/view' },
        { text: t('models.models.assets.breadcrumb') },
      ]);
      dispatch('UPDATE_HELP_PANEL', {
        isHidden: false,
        content: helpPanel,
      });
      dispatch('HELP_PANEL_IS_OPEN', false);
    }
  }, [isOperatorView, dispatch, t, operatorHelpPanel, helpPanel]);

  const removeAssetHandler = () => {
    setSelectedAssets([]);
  };

  const actionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <DeleteAssetModal
        disabled={selectedAssets.length === 0}
        selectedAssets={selectedAssets}
        onDelete={removeAssetHandler}
      />
      <DownloadAssetModal
        disabled={selectedAssets.length === 0}
        selectedAssets={selectedAssets}
        onDownload={removeAssetHandler}
        variant="primary"
      />
    </SpaceBetween>
  );

  const operatorActionButtons = actionButtons;

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={isOperatorView ? operatorHelpPanel : helpPanel}
      header={t('carlogs.assets.header')}
      description={
        isOperatorView ? t('carlogs.assets.operator.description') : t('carlogs.assets.description')
      }
      breadcrumbs={breadcrumbs}
    >
      <PageTable
        selectedItems={selectedAssets}
        setSelectedItems={setSelectedAssets}
        tableItems={assetsToDisplay}
        selectionType="multi"
        columnConfiguration={columnConfiguration}
        trackBy="assetId"
        header={
          <TableHeader
            nrSelectedItems={selectedAssets.length}
            nrTotalItems={assetsToDisplay.length}
            header={t('carlogs.assets.header')}
            actions={isOperatorView ? operatorActionButtons : actionButtons}
          />
        }
        itemsIsLoading={isLoading}
        isItemDisabled={(item) => ['NONE'].includes(item.type)}
        loadingText={t('carlogs.assets.loading-models')}
        localStorageKey="assets-table-preferences"
        filteringProperties={filteringProperties}
        filteringI18nStringsName="assets"
      />
    </PageLayout>
  );
};
