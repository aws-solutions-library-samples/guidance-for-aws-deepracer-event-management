import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Header, Pagination, Table, TextFilter } from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/pageLayout';
import {
  AdminModelsColumnsConfig,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TablePreferences,
} from '../../components/tableConfig';
import * as queries from '../../graphql/queries';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useToolsOptionsDispatch } from '../../store/appLayoutProvider';
import { formatAwsDateTime } from '../../support-functions/time';

const AdminQuarantine = () => {
  const { t } = useTranslation();

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
        // content: (
        //   <SimpleHelpPanelLayout
        //     headerContent={t('header', { ns: 'help-admin-models-quarantine' })}
        //     bodyContent={t('content', { ns: 'help-admin-models-quarantine' })}
        //     footerContent={t('footer', { ns: 'help-admin-models-quarantine' })}
        //   />
        // ),
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
              <Button onClick={() => actions.setFiltering('')}>{t('models.clear-filter')}</Button>
            }
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: adminModelsColsConfig[3], isDescending: true } },
      selection: {},
    });
  const { selectedItems } = collectionProps;

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
