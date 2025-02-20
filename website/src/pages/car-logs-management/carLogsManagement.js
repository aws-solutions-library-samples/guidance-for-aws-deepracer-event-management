import { SpaceBetween, Tabs } from '@cloudscape-design/components';
import Button from '@cloudscape-design/components/button';
import { API, Auth } from 'aws-amplify';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  ColumnConfigurationProc,
  FilteringPropertiesProc,
} from '../../components/tableCarLogsAssetsProcessing';
import { TableHeader } from '../../components/tableConfig';
import * as queries from '../../graphql/queries';
import * as subscriptions from '../../graphql/subscriptions';
import { useCarLogsApi } from '../../hooks/useCarLogsApi';
import { useSelectedEventContext } from '../../store/contexts/storeProvider';
import { useStore } from '../../store/store';
import { DeleteAssetModal } from './components/deleteAssetModal';
import { DownloadAssetModal } from './components/downloadAssetModal';

export const CarLogsManagement = ({ isOperatorView = false, onlyDisplayOwnAssets = true }) => {
  const { t } = useTranslation(['translation', 'help-model-carlogs', 'help-admin-model-carlogs']);
  const [columnConfiguration, setColumnConfiguration] = useState(() => ColumnConfigurationRacer());
  const [filteringProperties, setFilteringProperties] = useState(() => FilteringPropertiesRacer());
  const [activeTab, setActiveTab] = useState('tab1');
  const [filters, setFilters] = useState({ tokens: [], operation: 'and' });
  const [filteringPropertiesProc] = useState(() => FilteringPropertiesProc());
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [allJobItems, setJobItems] = useState([]);
  const [state] = useStore();
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const isLoading = state.assets.isLoading;
  const [, dispatch] = useStore();
  const assets = state.assets.assets;
  const { triggerReload } = useCarLogsApi();
  const selectedEvent = useSelectedEventContext();

  const assetsToDisplay = onlyDisplayOwnAssets
    ? assets.filter((asset) => asset.sub === Auth.user.attributes.sub)
    : assets;

  const reloadAssets = async () => {
    await triggerReload();
  };

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

  const navigateToAssetTabWithFilter = (jobId) => {
    setActiveTab('tab1');
    setFilters({
      tokens: [{ propertyKey: 'fetchJobId', operator: '=', value: jobId }],
      operation: 'and',
    });
    console.log('Filtering by jobId:', jobId);
  };
  const [columnConfigurationProc] = useState(() =>
    ColumnConfigurationProc(navigateToAssetTabWithFilter)
  );

  useMemo(() => {
    if (isOperatorView) {
      setColumnConfiguration(() => ColumnConfigurationOperator());
      setFilteringProperties(() => FilteringPropertiesOperator());
    }
  }, [isOperatorView]);

  useEffect(() => {
    if (isOperatorView) {
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

  const listFetchesFromCar = useCallback(async () => {
    setIsLoadingJobs(true);
    setJobItems([]);
    const response = await API.graphql({
      query: queries.listFetchesFromCar,
      variables: {
        eventId: selectedEvent.eventId,
      },
    });
    setJobItems(response.data.listFetchesFromCar);
    setIsLoadingJobs(false);
  }, [selectedEvent.eventId]);

  const actionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <Button iconName="refresh" variant="normal" disabled={isLoading} onClick={reloadAssets} />
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

  const fetchActionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <Button
        iconName="refresh"
        variant="normal"
        disabled={isLoadingJobs}
        onClick={listFetchesFromCar}
      />
    </SpaceBetween>
  );

  useEffect(() => {
    if (typeof selectedEvent.eventId !== 'undefined' && isOperatorView) {
      listFetchesFromCar();
    }
    return () => {
      // Unmounting
    };
  }, [selectedEvent, setJobItems, isOperatorView, listFetchesFromCar]);

  useEffect(() => {
    if (activeTab !== 'tab1') setFilters({ tokens: [], operation: 'and' });
    return () => {
      // Unmounting
    };
  }, [activeTab]);

  useEffect(() => {
    let subscriptionCreate;
    let subscriptionUpdate;

    async function subscribeToFetches() {
      subscriptionCreate = API.graphql({
        query: subscriptions.onFetchesFromCarCreated,
        variables: {
          eventId: selectedEvent.eventId,
        },
      }).subscribe({
        next: ({ value }) => {
          const newFetch = value.data.onFetchesFromCarCreated;
          setJobItems((prevItems) => [...prevItems, newFetch]);
        },
        error: (error) => console.warn(error),
      });

      subscriptionUpdate = API.graphql({
        query: subscriptions.onFetchesFromCarUpdated,
        variables: {
          eventId: selectedEvent.eventId,
        },
      }).subscribe({
        next: ({ value }) => {
          const updatedFetch = value.data.onFetchesFromCarUpdated;
          setJobItems((prevItems) =>
            prevItems.map((item) => (item.jobId === updatedFetch.jobId ? updatedFetch : item))
          );
        },
        error: (error) => console.warn(error),
      });
    }

    if (isOperatorView) {
      subscribeToFetches();
    }

    return () => {
      if (subscriptionCreate) {
        subscriptionCreate.unsubscribe();
      }
      if (subscriptionUpdate) {
        subscriptionUpdate.unsubscribe();
      }
    };
  }, [isOperatorView, dispatch, selectedEvent]);

  if (isOperatorView) {
    return (
      <PageLayout
        helpPanelHidden={false}
        helpPanelContent={operatorHelpPanel}
        header={t('carlogs.assets.header')}
        description={t('carlogs.assets.operator.description')}
        breadcrumbs={breadcrumbs}
      >
        <Tabs
          activeTabId={activeTab}
          onChange={({ detail }) => setActiveTab(detail.activeTabId)}
          tabs={[
            {
              label: t('carlogs.assets.tab1'),
              id: 'tab1',
              content: (
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
                      actions={actionButtons}
                    />
                  }
                  itemsIsLoading={isLoading}
                  isItemDisabled={(item) => ['NONE'].includes(item.type)}
                  loadingText={t('carlogs.assets.loading-models')}
                  localStorageKey="assets-table-preferences"
                  filteringProperties={filteringProperties}
                  filteringI18nStringsName="assets"
                  query={filters}
                />
              ),
            },
            {
              label: t('carlogs.assets.tab2'),
              id: 'tab2',
              content: (
                <PageTable
                  tableItems={allJobItems}
                  columnConfiguration={columnConfigurationProc}
                  trackBy="jobId"
                  header={
                    <TableHeader
                      nrTotalItems={allJobItems.length}
                      header={t('carlogs.assets.proc-header')}
                      actions={fetchActionButtons}
                    />
                  }
                  itemsIsLoading={isLoadingJobs}
                  isItemDisabled={(item) => ['NONE'].includes(item.type)}
                  loadingText={t('carlogs.assets.loading-processing')}
                  localStorageKey="assets-proc-table-preferences"
                  filteringProperties={filteringPropertiesProc}
                  filteringI18nStringsName="assets"
                />
              ),
            },
          ]}
        />
      </PageLayout>
    );
  } else {
    return (
      <PageLayout
        helpPanelHidden={false}
        helpPanelContent={helpPanel}
        header={t('carlogs.assets.header')}
        description={t('carlogs.assets.description')}
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
              actions={actionButtons}
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
  }
};
