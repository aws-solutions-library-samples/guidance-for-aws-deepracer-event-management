import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Table } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../../components/tableConfig';
import { ColumnConfiguration } from '../support-functions/lapsTableConfig';

const LapsTable = ({ race, tableSettings, onSelectionChange, selectedLaps, isEditable }) => {
  const { t } = useTranslation();
  const [laps, setLaps] = useState([]);

  useEffect(() => {
    if (!race) return;
    setLaps(race.laps);
  }, [race]);

  // Table config
  const columnConfiguration = ColumnConfiguration(isEditable);

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(laps, {
      filtering: {
        empty: <EmptyState title={t('race-admin.no-races')} />,
        noMatch: (
          <EmptyState
            title={t('common.no-matches')}
            subtitle={t('common.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>{t('table.clear-filter')}</Button>
            }
          />
        ),
      },
      pagination: { pageSize: 20 },
      sorting: { defaultState: { sortingColumn: columnConfiguration.columnDefinitions[0] } },
      selection: {},
    });

  // JSX
  return (
    <Table
      {...collectionProps}
      {...tableSettings}
      stickyHeader={true}
      stripedRows={true}
      onSelectionChange={({ detail }) => {
        onSelectionChange(detail.selectedItems);
      }}
      selectedItems={selectedLaps}
      columnDefinitions={columnConfiguration.columnDefinitions}
      items={items}
      trackBy="lapId"
      visibleColumns={columnConfiguration.visibleContent}
    />
  );
};

export { LapsTable };
