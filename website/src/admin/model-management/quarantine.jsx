import { useCollection } from '@cloudscape-design/collection-hooks';
import { Header, Pagination, PropertyFilter, Table } from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';

import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/pageLayout';
import {
  PropertyFilterI18nStrings,
  TableEmptyState,
  TableNoMatchState,
} from '../../components/tableCommon';
import {
  AdminModelsColumnsConfig,
  DefaultPreferences,
  MatchesCountText,
  TablePreferences,
} from '../../components/tableConfig';
import * as queries from '../../graphql/queries';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useToolsOptionsDispatch } from '../../store/appLayoutProvider';
import { formatAwsDateTime } from '../../support-functions/time';

const AdminQuarantine = () => {
  const { t } = useTranslation(['translation', 'help-admin-model-quarantine']);

  const [allItems, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const toolsOptionsDispatch = useToolsOptionsDispatch();

  async function getQuarantinedModels() {
    const response = await API.graphql({
      query: queries.getQuarantinedModels,
    });
    const models_response = response.data.getQuarantinedModels;
    const models = models_response.map(function (model, i) {
      const modelKeyPieces = model.modelKey.split('/');
      return {
        id: i,
        userName: modelKeyPieces[modelKeyPieces.length - 3],
        modelName: modelKeyPieces[modelKeyPieces.length - 1],
        modelDate: formatAwsDateTime(model.LastModified),
      };
    });
    setItems(models);
    setIsLoading(false);
  }

  useEffect(() => {
    getQuarantinedModels();
    return () => {
      // Unmounting
    };
  }, []);

  // Help panel
  const helpPanelHidden = true;
  useEffect(() => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        //isOpen: true,
        isHidden: helpPanelHidden,
        content: (
          <SimpleHelpPanelLayout
            headerContent={t('header', { ns: 'help-admin-model-quarantine' })}
            bodyContent={t('content', { ns: 'help-admin-model-quarantine' })}
            footerContent={t('footer', { ns: 'help-admin-model-quarantine' })}
          />
        ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

  const [preferences, setPreferences] = useLocalStorage('DREM-quarantine-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['userName', 'modelName', 'modelDate'],
  });

  const adminModelsColsConfig = AdminModelsColumnsConfig();

  const filteringProperties = [
    {
      key: 'userName',
      propertyLabel: t('models.user-name'),
      operators: [':', '!:', '=', '!='],
    },
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

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(allItems, {
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
    sorting: { defaultState: { sortingColumn: adminModelsColsConfig[3], isDescending: true } },
    selection: {},
  });
  const { selectedItems } = collectionProps;

  return (
    <PageLayout
      helpPanelHidden={helpPanelHidden}
      header={t('quarantine.header')}
      description={t('quarantine.list-of-all-models')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('quarantine.breadcrumb') },
      ]}
    >
      <Table
        {...collectionProps}
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${allItems.length})`
                : `(${allItems.length})`
            }
          >
            {t('quarantine.header')}
          </Header>
        }
        columnDefinitions={adminModelsColsConfig}
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
};

export { AdminQuarantine };
