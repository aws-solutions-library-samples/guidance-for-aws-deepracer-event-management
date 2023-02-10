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
import { Auth, Storage } from 'aws-amplify';
import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { ContentHeader } from './components/contentHeader';
import DeleteModelModal from './components/deleteModelModal';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  UserModelsColumnsConfig,
  WrapLines,
} from './components/tableConfig';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const Models = () => {
  const { t } = useTranslation();

  const [allItems, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModelsBtn, setSelectedModelsBtn] = useState(true);

  useEffect(() => {
    const getData = async () => {
      Auth.currentAuthenticatedUser()
        .then((user) => {
          const username = user.username;
          const s3Path = username + '/models';
          Storage.list(s3Path, { level: 'private' }).then((models) => {
            if (models !== undefined) {
              var userModels = models.map(function (model) {
                const modelKeyPieces = model.key.split('/');
                return {
                  key: model.key,
                  modelName: modelKeyPieces[modelKeyPieces.length - 1],
                  modelDate: dayjs(model.lastModified).format('YYYY-MM-DD HH:mm:ss (z)'),
                };
              });
              setItems(userModels);
              setIsLoading(false);
            }
          });
        })
        .catch((err) => {
          console.log(err);
        });
    };

    getData();

    return () => {
      // Unmounting
    };
  }, []);

  const removeItem = (key) => {
    setSelectedModelsBtn(true);
    setItems((items) => items.filter((items) => items.key !== key));
    setSelectedItems((items) => items.filter((items) => items.key !== key));
  };

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['modelName', 'modelDate'],
  });

  const userModelsColsConfig = UserModelsColumnsConfig();

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
      sorting: { defaultState: { sortingColumn: userModelsColsConfig[2], isDescending: true } },
      selection: {},
    });

  const visibleContentOptions = [
    {
      label: t('models.model-information'),
      options: [
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
        header={t('models.header')}
        description={t('models.list-of-your-uploaded-models')}
        breadcrumbs={[{ text: t('home.breadcrumb'), href: '/' }, { text: t('models.breadcrumb') }]}
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
                  <DeleteModelModal
                    disabled={selectedModelsBtn}
                    selectedItems={selectedItems}
                    removeItem={removeItem}
                    variant="primary"
                  />
                </SpaceBetween>
              }
            >
              {t('models.header')}
            </Header>
          }
          columnDefinitions={userModelsColsConfig}
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
          trackBy="modelName"
          resizableColumns
          onSelectionChange={({ detail: { selectedItems } }) => {
            setSelectedItems(selectedItems);
            selectedItems.length ? setSelectedModelsBtn(false) : setSelectedModelsBtn(true);
          }}
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

export { Models };
