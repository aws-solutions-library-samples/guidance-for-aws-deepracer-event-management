import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Header,
  Pagination,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  UserModelsColumnsConfig,
  WrapLines,
} from '../../../components/tableConfig';

export const ModelsTable = ({
  models,
  selectedModels,
  setSelectedModels,
  isLoading,
  actionButtons,
}) => {
  const { t } = useTranslation();

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['modelName', 'modelDate'],
  });

  const userModelsColsConfig = UserModelsColumnsConfig();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(models, {
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
    <Table
      {...collectionProps}
      header={
        <Header
          counter={
            selectedModels.length
              ? `(${selectedModels.length}/${selectedModels.length})`
              : `(${models.length})`
          }
          actions={actionButtons}
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
      selectedItems={selectedModels}
      selectionType="multi"
      stickyHeader="true"
      trackBy="modelName"
      resizableColumns
      onSelectionChange={({ detail: { selectedItems } }) => {
        setSelectedModels(selectedItems);
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
            title: t('table.select-visible-columns'),
            options: visibleContentOptions,
          }}
          wrapLinesPreference={WrapLines}
        />
      }
    />
  );
};
