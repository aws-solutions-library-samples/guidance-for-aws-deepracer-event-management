import { useCollection } from '@cloudscape-design/collection-hooks';
import { Header, Pagination, PropertyFilter, Table } from '@cloudscape-design/components';
import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';
import {
  PropertyFilterI18nStrings,
  TableEmptyState,
  TableNoMatchState,
} from '../../../components/tableCommon';
import {
  DefaultPreferences,
  MatchesCountText,
  TablePreferences,
  UserModelsColumnsConfig,
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

  const filteringProperties = [
    {
      key: 'modelName',
      propertyLabel: t('models.model-name'),
      operators: [':', '!:', '=', '!='],
    },
    // {
    //   key: 'modelDate',
    //   propertyLabel: t('models.upload-date'),
    //   groupValuesLabel: 'Created at value',
    //   defaultOperator: '>',
    //   operators: ['<', '<=', '>', '>='].map((operator) => ({
    //     operator,
    //     form: ({ value, onChange }) => (
    //       <div className="date-form">
    //         {' '}
    //         <FormField>
    //           {' '}
    //           <DateInput
    //             value={value ?? ''}
    //             onChange={(event) => onChange(event.detail.value)}
    //             placeholder="YYYY/MM/DD"
    //           />{' '}
    //         </FormField>{' '}
    //         <Calendar
    //           value={value ?? ''}
    //           onChange={(event) => onChange(event.detail.value)}
    //           locale="en-GB"
    //         />{' '}
    //       </div>
    //     ),
    //     format: formatAwsDateTime,
    //     match: 'date',
    //   })),
    // },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(models, {
    propertyFiltering: {
      filteringProperties,
      empty: <TableEmptyState resourceName="Model" />,
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
          i18nStrings={PropertyFilterI18nStrings('models')}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('models.filter-groups')}
          expandToViewport={true}
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
        <TablePreferences
          preferences={preferences}
          setPreferences={setPreferences}
          contentOptions={visibleContentOptions}
        />
      }
    />
  );
};
