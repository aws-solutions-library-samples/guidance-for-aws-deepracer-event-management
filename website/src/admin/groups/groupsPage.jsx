import { useCollection } from '@cloudscape-design/collection-hooks';
import { Header, Pagination, PropertyFilter, Table } from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import {
  PropertyFilterI18nStrings,
  TableEmptyState,
  TableNoMatchState,
} from '../../components/tableCommon';
import {
  DefaultPreferences,
  MatchesCountText,
  TablePreferences,
} from '../../components/tableConfig';
import {
  ColumnDefinitions,
  FilteringProperties,
  VisibleContentOptions,
} from '../../components/tableGroupConfig';
import { useGroupsApi } from '../../hooks/useGroupsApi';
import { useLocalStorage } from '../../hooks/useLocalStorage';

export function GroupsPage() {
  const { t } = useTranslation(['translation', 'help-admin-groups']);

  const [selectedItems] = useState([]);
  const [groups, isLoading] = useGroupsApi();

  const [preferences, setPreferences] = useLocalStorage('DREM-groups-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['groupName', 'description'],
  });

  // Table config
  const columnDefinitions = ColumnDefinitions();
  const filteringProperties = FilteringProperties();
  const visibleContentOptions = VisibleContentOptions();

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(groups, {
    propertyFiltering: {
      filteringProperties,
      empty: <TableEmptyState resourceName="Group" />,
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
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: { defaultState: { sortingColumn: columnDefinitions[0] } },
    selection: {},
  });

  return (
    <PageLayout
      helpPanelHidden={true}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-groups' })}
          bodyContent={t('content', { ns: 'help-admin-groups' })}
          footerContent={t('footer', { ns: 'help-admin-groups' })}
        />
      }
      header={t('groups.header')}
      description={t('groups.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('groups.breadcrumb') },
      ]}
    >
      <Table
        {...collectionProps}
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${groups.length})`
                : `(${groups.length})`
            }
          >
            {t('groups.header')}
          </Header>
        }
        columnDefinitions={columnDefinitions}
        items={items}
        stripedRows={preferences.stripedRows}
        contentDensity={preferences.contentDensity}
        wrapLines={preferences.wrapLines}
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
          <PropertyFilter
            {...propertyFilterProps}
            i18nStrings={PropertyFilterI18nStrings('groups')}
            countText={MatchesCountText(filteredItemsCount)}
            filteringAriaLabel={t('groups.filter-groups')}
            expandToViewport={true}
          />
        }
        loading={isLoading}
        loadingText={t('groups.loading-groups')}
        visibleColumns={preferences.visibleContent}
        selectedItems={selectedItems}
        stickyHeader="true"
        trackBy="GroupName"
        resizableColumns
        preferences={
          <TablePreferences
            preferences={preferences}
            setPreferences={setPreferences}
            contentOptions={visibleContentOptions}
          />
        }
      />
    </PageLayout>
  );
}
