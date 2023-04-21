import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { PageLayout } from '../components/pageLayout';
import * as queries from '../graphql/queries';
import { useLocalStorage } from '../hooks/useLocalStorage';
// import * as mutations from '../graphql/mutations';
// import * as subscriptions from '../graphql/subscriptions'

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Header,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { formatAwsDateTime } from '../support-functions/time';

import { useTranslation } from 'react-i18next';
import {
  AdminModelsColumnsConfig,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/tableConfig';
import CarModelUploadModal from './carModelUploadModal';

const AdminModels = () => {
  const { t } = useTranslation();

  const [allModels, setAllModels] = useState([]);
  const [cars, setCars] = useState([]);
  const [modelsIsLoading, setModelsIsLoading] = useState(true);
  const [carsIsLoading, setCarsIsLoading] = useState(true);
  const [selectedModelsBtn, setSelectedModelsBtn] = useState(true);

  async function getCarsOnline() {
    setCarsIsLoading(true);
    console.log('Collecting cars...');
    // Get CarsOnline
    const response = await API.graphql({
      query: queries.carsOnline,
      variables: { online: true },
    });
    setCars(response.data.carsOnline);
    setCarsIsLoading(false);
  }
  async function getModels() {
    setModelsIsLoading(true);
    console.log('Collecting models...');
    const response = await API.graphql({
      query: queries.getAllModels,
    });
    console.log(response);
    const models_response = response.data.getAllModels;
    const models = models_response.map(function (model, i) {
      const modelKeyPieces = model.modelKey.split('/');
      return {
        key: model.modelKey,
        userName: modelKeyPieces[modelKeyPieces.length - 3],
        modelName: modelKeyPieces[modelKeyPieces.length - 1],
        modelDate: formatAwsDateTime(model.uploadedDateTime),
        ...model,
      };
    });
    setAllModels(models);
    setModelsIsLoading(false);
  }

  useEffect(() => {
    getModels();
    getCarsOnline();

    return () => {
      // Unmounting
    };
  }, []);

  const [preferences, setPreferences] = useLocalStorage('DREM-models-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['userName', 'modelName', 'modelDate'],
  });

  const adminModelsColsConfig = AdminModelsColumnsConfig();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(allModels, {
      filtering: {
        empty: (
          <EmptyState title={t('models.no-models')} subtitle={t('models.no-models-to-display')} />
        ),
        noMatch: (
          <EmptyState
            title={t('models.no-matches')}
            subtitle={t('models.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>{t('table.clear-filter')}</Button>
            }
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: adminModelsColsConfig[3], isDescending: true } },
      selection: {},
    });
  const [selectedItems, setSelectedItems] = useState([]);

  const visibleContentOptions = [
    {
      label: t('models.model-information'),
      options: [
        {
          id: 'modelId',
          label: t('models.model-id'),
        },
        {
          id: 'userName',
          label: t('models.user-name'),
          editable: false,
        },
        {
          id: 'modelName',
          label: t('models.model-name'),
          editable: false,
        },
        {
          id: 'modelDate',
          label: t('models.upload-date'),
        },
        {
          id: 'modelMD5Hash',
          label: t('models.md5-hash'),
        },
        {
          id: 'modelMetadataMD5Hash',
          label: t('models.md5-hash-metadata'),
        },
        {
          id: 'modelS3Key',
          label: t('models.model-s3-key'),
        },
      ],
    },
  ];

  return (
    <PageLayout
      header={t('models.all-header')}
      description={t('models.list-of-all-uploaded-models')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('models.breadcrumb') },
      ]}
    >
      <Table
        {...collectionProps}
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${allModels.length})`
                : `(${allModels.length})`
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  onClick={() => {
                    setSelectedItems([]);
                    setSelectedModelsBtn(true);
                  }}
                >
                  {t('button.clear-selected')}
                </Button>
                <CarModelUploadModal
                  disabled={selectedModelsBtn}
                  selectedModels={selectedItems}
                  cars={cars}
                ></CarModelUploadModal>
              </SpaceBetween>
            }
          >
            {t('models.all-header')}
          </Header>
        }
        columnDefinitions={adminModelsColsConfig}
        items={items}
        pagination={
          <Pagination
            {...paginationProps}
            ariaLabels={{
              nextPageLabel: t('table.next-page'),
              previousPageLabel: t('table.previous-page'),
              pageLabel: (pageNumber) => `$(t{'table.go-to-page')} ${pageNumber}`,
            }}
          />
        }
        filter={
          <TextFilter
            {...filterProps}
            countText={MatchesCountText(filteredItemsCount)}
            filteringAriaLabel={t('models.filter-models')}
          />
        }
        loading={modelsIsLoading || carsIsLoading}
        loadingText={t('models.loading-models')}
        visibleColumns={preferences.visibleContent}
        selectedItems={selectedItems}
        selectionType="multi"
        stickyHeader="true"
        trackBy={'key'}
        onSelectionChange={({ detail: { selectedItems } }) => {
          setSelectedItems(selectedItems);
          selectedItems.length ? setSelectedModelsBtn(false) : setSelectedModelsBtn(true);
        }}
        resizableColumns
        preferences={
          <CollectionPreferences
            title={t('table.preferences')}
            confirmLabel={t('button.confirm')}
            cancelLabel={t('button.cancel')}
            onConfirm={({ detail }) => setPreferences(detail)}
            preferences={preferences}
            pageSizePreference={PageSizePreference(t('models.page-size-label'))}
            visibleContentPreference={{
              title: t('table.select-visible-colunms'),
              options: visibleContentOptions,
            }}
            wrapLinesPreference={WrapLines}
          />
        }
      />
    </PageLayout>
  );
};

export { AdminModels };
