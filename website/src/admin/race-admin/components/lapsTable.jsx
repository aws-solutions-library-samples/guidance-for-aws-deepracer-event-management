import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Table } from '@cloudscape-design/components';
import React, { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DefaultPreferences, EmptyState } from '../../../components/tableConfig';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import {
  ColumnDefinitions,
  EditableColumnDefinitions,
  VisibleContentOptions,
} from '../support-functions/lapsTableConfig';

const tableSettingsHandler = (state, action) => {
  console.info(action);
  return { ...state, ...action };
  // return {
  //   stickyHeader: 'true',
  //   resizableColumns: 'true',
  //   header: (
  //     <TableHeader
  //       nrSelectedItems={0}
  //       nrTotalItems={10}
  //       //onEdit={editRaceHandler}
  //       //onDelete={() => setDeleteModalVisible(true)}
  //       //onAdd={addEventHandler}
  //       header={'Laps'} //{t('race-admin.races-table-header')}
  //     />
  //   ),
  // };
};

const LapsTable = ({ race, tableSettings, onSelectionChange, selectedLaps, isEditable }) => {
  const { t } = useTranslation();
  const [laps, setLaps] = useState([]);
  const [tableConfig, dispatchTableConfig] = useReducer(tableSettingsHandler, {
    stickyHeader: 'true',
    stripedRows: 'true',
    // resizableColumns: 'true',
  });

  useEffect(() => {
    if (!race) return;
    setLaps(race.laps);
    console.log(race);
  }, [race]);

  useEffect(() => {
    dispatchTableConfig(tableSettings);
  }, [tableSettings]);

  const [preferences] = useLocalStorage('DREM-race-details-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['lapId', 'time', 'resets', 'isValid'],
  });

  // Table config
  const columnDefinitions = isEditable ? EditableColumnDefinitions() : ColumnDefinitions();
  const visibleContentOptions = VisibleContentOptions();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(laps, {
      filtering: {
        empty: <EmptyState title={t('race-admin.no-races')} />,
        noMatch: (
          <EmptyState
            title={t('table.no-matches')}
            subtitle={t('table.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>{t('table.clear-filter')}</Button>
            }
          />
        ),
      },
      pagination: { pageSize: 20 },
      sorting: { defaultState: { sortingColumn: columnDefinitions[0] } },
      selection: {},
    });

  // JSX
  return (
    <Table
      {...collectionProps}
      {...tableConfig}
      onSelectionChange={({ detail }) => {
        onSelectionChange(detail.selectedItems);
      }}
      selectedItems={selectedLaps}
      columnDefinitions={columnDefinitions}
      items={items}
      //loading={loading}
      //loadingText={t('events.loading')}
      //      stickyHeader="true"
      trackBy="lapId"
      // filter={
      //   <TextFilter
      //     {...filterProps}
      //     countText={MatchesCountText(filteredItemsCount)}
      //     filteringAriaLabel={t('events.filter')}
      //   />
      // }

      //pagination={<TablePagination paginationProps={paginationProps} />}
      visibleColumns={preferences.visibleContent}
      // preferences={
      //   <TablePreferences
      //     preferences={preferences}
      //     setPreferences={setPreferences}
      //     contentOptions={visibleContentOptions}
      //   />
      // }
    />
  );
};

export { LapsTable };
