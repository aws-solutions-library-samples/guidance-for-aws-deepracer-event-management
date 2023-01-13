import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
import { useLocalStorage } from '../hooks/useLocalStorage';
// import * as mutations from '../graphql/mutations';
// import * as subscriptions from '../graphql/subscriptions'

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Grid,
  Header,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ContentHeader } from '../components/ContentHeader';
import {
  AdminModelsColumnsConfig,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/TableConfig';
import CarModelUploadModal from './carModelUploadModal.js';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const AdminModels = () => {
  const { t } = useTranslation();

  const [allItems, setItems] = useState([]);
  const [cars, setCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModelsBtn, setSelectedModelsBtn] = useState(true);

  useEffect(() => {
    async function getData() {
      console.log('Collecting models...');
      const apiName = 'deepracerEventManager';
      const apiPath = 'models';

      const response = await API.get(apiName, apiPath);
      var models = response.map(function (model, i) {
        // TODO: Fix inconsistency in model.Key / model.key in /admin/model.js and /models.js
        const modelKeyPieces = model.Key.split('/');
        return {
          key: model.Key,
          userName: modelKeyPieces[modelKeyPieces.length - 3],
          modelName: modelKeyPieces[modelKeyPieces.length - 1],
          modelDate: dayjs(model.LastModified).format('YYYY-MM-DD HH:mm:ss (z)'),
        };
      });
      setItems(models);
      console.log(allItems);

      console.log('Collecting cars...');
      // Get CarsOnline
      async function carsOnline() {
        const response = await API.graphql({
          query: queries.carsOnline,
          variables: { online: true },
        });
        setCars(response.data.carsOnline);
      }
      carsOnline();

      setIsLoading(false);
    }
    console.log(cars);
    getData();

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
    useCollection(allItems, {
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
      ],
    },
  ];

  return (
    <>
      <ContentHeader
        header={t('models.all-header')}
        description={t('models.list-of-all-uploaded-models')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('admin.breadcrumb'), href: '/admin/home' },
          { text: t('models.breadcrumb') },
        ]}
      />

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <Table
          {...collectionProps}
          header={
            <Header
              counter={
                selectedItems.length
                  ? `(${selectedItems.length}/${allItems.length})`
                  : `(${allItems.length})`
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
          loading={isLoading}
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
        <div></div>
      </Grid>
    </>
  );
};

export { AdminModels };
