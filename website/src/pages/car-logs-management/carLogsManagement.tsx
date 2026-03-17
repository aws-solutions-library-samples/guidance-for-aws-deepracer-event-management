import { SpaceBetween, Tabs } from '@cloudscape-design/components';
import Button from '@cloudscape-design/components/button';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
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
import { graphqlMutate, graphqlSubscribe } from '../../graphql/graphqlHelpers';
import * as queries from '../../graphql/queries';
import * as subscriptions from '../../graphql/subscriptions';
import { getCurrentAuthUser } from '../../hooks/useAuth';
import { useCarLogsApi } from '../../hooks/useCarLogsApi';
import { useSelectedEventContext } from '../../store/contexts/storeProvider';
import { useStore } from '../../store/store';
import { CarLogAsset } from '../../types/domain';
import { DeleteAssetModal } from './components/deleteAssetModal';
import { DownloadAssetModal } from './components/downloadAssetModal';

// Type definitions
interface CarLogsManagementProps {
  isOperatorView?: boolean;
  onlyDisplayOwnAssets?: boolean;
}

interface FetchJob {
  jobId: string;
  type?: string;
  [key: string]: any;
}

interface FilterState {
  tokens: Array<{ propertyKey: string; operator: string; value: string }>;
  operation: string;
}

interface ListFetchesFromCarResponse {
  listFetchesFromCar: FetchJob[];
}

interface SubscriptionValue<T> {
  value: {
    data: T;
  };
}

type GraphQLSubscription = {
  unsubscribe: () => void;
};

export const CarLogsManagement: React.FC<CarLogsManagementProps> = ({ 
  isOperatorView = false, 
  onlyDisplayOwnAssets = true 
}) => {
  const { t } = useTranslation(['translation', 'help-model-carlogs', 'help-admin-model-carlogs']);
  const [columnConfiguration, setColumnConfiguration] = useState(() => ColumnConfigurationRacer());
  const [filteringProperties, setFilteringProperties] = useState(() => FilteringPropertiesRacer());
  const [activeTab, setActiveTab] = useState<string>('tab1');
  const [filters, setFilters] = useState<FilterState>({ tokens: [], operation: 'and' });
  const [filteringPropertiesProc] = useState(() => FilteringPropertiesProc());
  const [selectedAssets, setSelectedAssets] = useState<CarLogAsset[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ text: string; href?: string }>>([]);
  const [allJobItems, setJobItems] = useState<FetchJob[]>([]);
  const [state] = useStore();
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(true);
  const isLoading = state.assets?.isLoading || false;
  const [, dispatch] = useStore();
  const assets: CarLogAsset[] = state.assets?.assets || [];
  const { triggerReload } = useCarLogsApi();
  const selectedEvent = useSelectedEventContext();
  const [currentUserSub, setCurrentUserSub] = useState<string>('');

  useEffect(() => {
    getCurrentAuthUser().then((authUser) => {
      setCurrentUserSub(authUser.sub);
    });
  }, []);

  const assetsToDisplay: CarLogAsset[] = onlyDisplayOwnAssets
    ? assets.filter((asset: any) => asset.sub === currentUserSub || asset.username === currentUserSub)
    : assets;

  const reloadAssets = async (): Promise<void> => {
    await triggerReload();
  };

  const operatorHelpPanel: ReactElement = useMemo(() => {
    return (
      <SimpleHelpPanelLayout
        headerContent={t('header', { ns: 'help-admin-model-carlogs' })}
        bodyContent={t('content', { ns: 'help-admin-model-carlogs' })}
        footerContent={t('footer', { ns: 'help-admin-model-carlogs' })}
      />
    );
  }, [t]);

  const helpPanel: ReactElement = useMemo(() => {
    return (
      <SimpleHelpPanelLayout
        headerContent={t('header', { ns: 'help-model-carlogs' })}
        bodyContent={t('content', { ns: 'help-model-carlogs' })}
        footerContent={t('footer', { ns: 'help-model-carlogs' })}
      />
    );
  }, [t]);

  const navigateToAssetTabWithFilter = (jobId: string): void => {
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
      setColumnConfiguration(ColumnConfigurationOperator() as any);
      setFilteringProperties(FilteringPropertiesOperator() as any);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOperatorView, dispatch, t]);

  const removeAssetHandler = (): void => {
    setSelectedAssets([]);
  };

  const listFetchesFromCar = useCallback(async (): Promise<void> => {
    setIsLoadingJobs(true);
    setJobItems([]);
    const response = await graphqlMutate<ListFetchesFromCarResponse>(
      queries.listFetchesFromCar,
      { eventId: selectedEvent?.eventId }
    );
    if (response?.listFetchesFromCar) {
      setJobItems(response.listFetchesFromCar);
    }
    setIsLoadingJobs(false);
  }, [selectedEvent?.eventId]);

  const actionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <Button iconName="refresh" variant="normal" disabled={isLoading} onClick={reloadAssets} />
      <DeleteAssetModal
        disabled={selectedAssets.length === 0}
        selectedAssets={selectedAssets as any}
        onDelete={removeAssetHandler}
      />
      <DownloadAssetModal
        disabled={selectedAssets.length === 0}
        selectedAssets={selectedAssets as any}
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
    if (typeof selectedEvent?.eventId !== 'undefined' && isOperatorView) {
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
    let subscriptionCreate: GraphQLSubscription | undefined;
    let subscriptionUpdate: GraphQLSubscription | undefined;

    async function subscribeToFetches(): Promise<void> {
      subscriptionCreate = graphqlSubscribe<{ onFetchesFromCarCreated: FetchJob }>(
        subscriptions.onFetchesFromCarCreated,
        { eventId: selectedEvent?.eventId }
      ).subscribe({
        next: ({ value }) => {
          const newFetch = value.data.onFetchesFromCarCreated;
          setJobItems((prevItems) => [...prevItems, newFetch]);
        },
        error: (error: Error) => console.warn(error),
      });

      subscriptionUpdate = graphqlSubscribe<{ onFetchesFromCarUpdated: FetchJob }>(
        subscriptions.onFetchesFromCarUpdated,
        { eventId: selectedEvent?.eventId }
      ).subscribe({
        next: ({ value }) => {
          const updatedFetch = value.data.onFetchesFromCarUpdated;
          setJobItems((prevItems) =>
            prevItems.map((item) => (item.jobId === updatedFetch.jobId ? updatedFetch : item))
          );
        },
        error: (error: Error) => console.warn(error),
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
        breadcrumbs={breadcrumbs as any}
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
                  columnConfiguration={columnConfiguration as any}
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
                  isItemDisabled={(item: any) => ['NONE'].includes(item.type)}
                  loadingText={t('carlogs.assets.loading-models')}
                  localStorageKey="assets-table-preferences"
                  filteringProperties={filteringProperties as any}
                  filteringI18nStringsName="assets"
                  query={filters as any}
                />
              ),
            },
            {
              label: t('carlogs.assets.tab2'),
              id: 'tab2',
              content: (
                <PageTable
                  selectedItems={[]}
                  setSelectedItems={() => {}}
                  tableItems={allJobItems}
                  columnConfiguration={columnConfigurationProc as any}
                  trackBy="jobId"
                  header={
                    <TableHeader
                      nrTotalItems={allJobItems.length}
                      header={t('carlogs.assets.proc-header')}
                      actions={fetchActionButtons}
                      nrSelectedItems={0}
                    />
                  }
                  itemsIsLoading={isLoadingJobs}
                  isItemDisabled={(item: any) => ['NONE'].includes(item.type)}
                  loadingText={t('carlogs.assets.loading-processing')}
                  localStorageKey="assets-proc-table-preferences"
                  filteringProperties={filteringPropertiesProc as any}
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
        breadcrumbs={breadcrumbs as any}
      >
        <PageTable
          selectedItems={selectedAssets}
          setSelectedItems={setSelectedAssets}
          tableItems={assetsToDisplay}
          selectionType="multi"
          columnConfiguration={columnConfiguration as any}
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
          isItemDisabled={(item: any) => ['NONE'].includes(item.type)}
          loadingText={t('carlogs.assets.loading-models')}
          localStorageKey="assets-table-preferences"
          filteringProperties={filteringProperties as any}
          filteringI18nStringsName="assets"
        />
      </PageLayout>
    );
  }
};
