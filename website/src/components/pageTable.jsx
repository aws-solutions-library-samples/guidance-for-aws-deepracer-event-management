import React from 'react';

import { useCollection } from '@cloudscape-design/collection-hooks';
import { PropertyFilter, Table } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { PropertyFilterI18nStrings, TableEmptyState, TableNoMatchState } from './tableCommon';
import {
  DefaultPreferences,
  MatchesCountText,
  TablePagination,
  TablePreferences,
} from './tableConfig';

export const PageTable = ({
  localStorageKey,
  selectedItems,
  setSelectedItems,
  tableItems,
  itemsIsLoading,
  loadingText,
  header,
  trackBy,
  filteringProperties,
  filteringI18nStringsName,
  selectionType,
  columnConfiguration,
  stickyHeader = true,
  query = { tokens: [], operation: 'and' },
  ...props
}) => {
  const { t } = useTranslation(['translation']);

  const [preferences, setPreferences] = useLocalStorage(`DREM-${localStorageKey}`, {
    ...DefaultPreferences,
    visibleContent: columnConfiguration.defaultVisibleColumns,
  });

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(tableItems, {
    propertyFiltering: filteringProperties
      ? {
          filteringProperties,
          empty: <TableEmptyState resourceName={filteringI18nStringsName} />,
          noMatch: (
            <TableNoMatchState
              onClearFilter={() => {
                actions.setPropertyFiltering({ tokens: [], operation: 'and' });
              }}
              label={t('common.no-matches')}
              description={t('common.we-cant-find-a-match')}
              buttonLabel={t('button.clear-filters')}
            />
          ),
        }
      : undefined,
    pagination: { pageSize: preferences.pageSize },
    sorting: { defaultState: { sortingColumn: columnConfiguration.columnDefinitions[0] } },
    selection: {},
  });

  return (
    <Table
      {...props}
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedItems(detail.selectedItems);
      }}
      selectedItems={selectedItems}
      selectionType={selectionType}
      columnDefinitions={columnConfiguration.columnDefinitions}
      items={items}
      stripedRows={preferences.stripedRows}
      contentDensity={preferences.contentDensity}
      wrapLines={preferences.wrapLines}
      loading={itemsIsLoading}
      loadingText={loadingText}
      stickyHeader
      trackBy={trackBy}
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={PropertyFilterI18nStrings(filteringI18nStringsName)}
          countText={MatchesCountText(filteredItemsCount)}
          expandToViewport={true}
        />
      }
      header={header}
      pagination={<TablePagination paginationProps={paginationProps} />}
      visibleColumns={preferences.visibleContent}
      resizableColumns
      preferences={
        <TablePreferences
          preferences={preferences}
          setPreferences={setPreferences}
          contentOptions={columnConfiguration.visibleContentOptions}
        />
      }
    />
  );
};
