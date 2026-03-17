import React, { useEffect } from 'react';

import { useCollection } from '@cloudscape-design/collection-hooks';
import { PropertyFilter, Table, TableProps } from '@cloudscape-design/components';
import type { PropertyFilterProps } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { PropertyFilterI18nStrings, TableEmptyState, TableNoMatchState } from './tableCommon';
import {
  DefaultPreferences,
  MatchesCountText,
  TablePagination,
  TablePreferences,
} from './tableConfig';

interface ColumnConfiguration<T> {
  columnDefinitions: TableProps.ColumnDefinition<T>[];
  defaultVisibleColumns: string[];
  visibleContentOptions: Array<{
    id?: string;
    label: string;
    editable?: boolean;
    options?: Array<{ id: string; label: string; editable?: boolean }>;
  }>;
  defaultSortingColumn?: TableProps.ColumnDefinition<T> | string;
  defaultSortingIsDescending?: boolean;
}

interface PropertyFilterQuery {
  tokens: PropertyFilterProps.Token[];
  operation: PropertyFilterProps.JoinOperation;
}

interface PageTableProps<T> extends Omit<TableProps<T>, 'items' | 'columnDefinitions'> {
  localStorageKey: string;
  selectedItems: T[];
  setSelectedItems: (items: T[]) => void;
  tableItems: T[];
  itemsIsLoading: boolean;
  loadingText: string;
  header: React.ReactNode;
  trackBy: string | ((item: T) => string);
  filteringProperties?: PropertyFilterProps.FilteringProperty[];
  filteringI18nStringsName: string;
  selectionType?: TableProps.SelectionType;
  columnConfiguration: ColumnConfiguration<T>;
  stickyHeader?: boolean;
  query?: PropertyFilterQuery;
}

export const PageTable = <T,>({
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
  query = { tokens: [], operation: 'and' as const },
  ...props
}: PageTableProps<T>) => {
  const { t } = useTranslation(['translation']);

  const [preferences, setPreferences] = useLocalStorage(`DREM-${localStorageKey}`, {
    ...DefaultPreferences,
    visibleContent: columnConfiguration.defaultVisibleColumns,
  });

  // check to see if defaultSortingColumn is configured, if not set it to column 0
  if(typeof columnConfiguration.defaultSortingColumn == "undefined") {
    console.log("defaultSortingColumn", "undefined");
    columnConfiguration.defaultSortingColumn = columnConfiguration.columnDefinitions[0]
  }

  // check to see if defaultSortingIsDescending is configured, if not set it to false
  if(typeof columnConfiguration.defaultSortingIsDescending == "undefined") {
    console.log("defaultSortingIsDescending", "undefined");
    columnConfiguration.defaultSortingIsDescending = false
  }

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
    sorting: { defaultState: { 
      sortingColumn: columnConfiguration.defaultSortingColumn as any,
      isDescending: columnConfiguration.defaultSortingIsDescending
    } },
    selection: {},
  });

  useEffect(() => {
    actions.setPropertyFiltering(query);

    return () => {
      // Unmounting
    };
  }, []);

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
      contentDensity={preferences.contentDensity as 'comfortable' | 'compact'}
      wrapLines={preferences.wrapLines}
      loading={itemsIsLoading}
      loadingText={loadingText}
      stickyHeader
      trackBy={trackBy}
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          onChange={({ detail }) => {
            actions.setPropertyFiltering(detail);
          }}
          // query={thisQuery}
          i18nStrings={PropertyFilterI18nStrings(filteringI18nStringsName)}
          countText={MatchesCountText(filteredItemsCount ?? 0)}
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
