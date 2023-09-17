import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';

import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';

import { TableHeader } from '../../components/tableConfig';

import {
  ColumnConfiguration,
  FilteringProperties,
} from '../../components/tableModelsConfigOperator';
import * as queries from '../../graphql/queries';
import { formatAwsDateTime } from '../../support-functions/time';

const AdminQuarantine = () => {
  const { t } = useTranslation(['translation', 'help-admin-model-quarantine']);

  const [allItems, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-model-quarantine' })}
          bodyContent={t('content', { ns: 'help-admin-model-quarantine' })}
          footerContent={t('footer', { ns: 'help-admin-model-quarantine' })}
        />
      }
      header={t('quarantine.header')}
      description={t('quarantine.list-of-all-models')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('operator.breadcrumb'), href: '/admin/home' },
        { text: t('models.breadcrumb'), href: '/admin/home' },
        { text: t('quarantine.breadcrumb') },
      ]}
    >
      <PageTable
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
        tableItems={allItems}
        columnConfiguration={columnConfiguration}
        header={
          <TableHeader
            nrSelectedItems={selectedItems.length}
            nrTotalItems={allItems.length}
            header={t('quarantine.header')}
          />
        }
        itemsIsLoading={isLoading}
        loadingText={t('models.loading-models')}
        localStorageKey="quarantine-table-preferences"
        filteringProperties={filteringProperties}
        filteringI18nStringsName="models"
      />
    </PageLayout>
  );
};

export { AdminQuarantine };
