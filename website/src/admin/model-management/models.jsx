import { Button, SpaceBetween } from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import {
  ColumnConfiguration,
  FilteringProperties,
} from '../../components/tableModelsConfigOperator';
import * as queries from '../../graphql/queries';
import { formatAwsDateTime } from '../../support-functions/time';

import { useTranslation } from 'react-i18next';
import { PageTable } from '../../components/pageTable';
import { TableHeader } from '../../components/tableConfig';
import CarModelUploadModal from './carModelUploadModal';

const AdminModels = () => {
  const { t } = useTranslation(['translation', 'help-admin-models']);

  const [allModels, setAllModels] = useState([]);
  const [cars, setCars] = useState([]);
  const [modelsIsLoading, setModelsIsLoading] = useState(true);
  const [carsIsLoading, setCarsIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);

  async function getCarsOnline() {
    setCarsIsLoading(true);
    console.debug('Collecting cars...');
    // Get CarsOnline
    const response = await API.graphql({
      query: queries.carsOnline,
      variables: { online: true },
    });
    setCars(response.data.carsOnline);
    setCarsIsLoading(false);
  }
  async function getModels() {
    setModelsIsLoading(true);
    console.debug('Collecting models...');
    const response = await API.graphql({
      query: queries.getAllModels,
    });
    const models_response = response.data.getAllModels;
    const models = models_response.map(function (model, i) {
      const modelKeyPieces = model.modelKey.split('/');
      return {
        key: model.modelKey,
        userName: modelKeyPieces[modelKeyPieces.length - 3],
        modelName: modelKeyPieces[modelKeyPieces.length - 1],
        modelDate: formatAwsDateTime(model.uploadedDateTime),
        ...model,
      };
    });
    setAllModels(models);
    setModelsIsLoading(false);
  }

  useEffect(() => {
    getModels();
    getCarsOnline();

    return () => {
      // Unmounting
    };
  }, []);

  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  const HeaderActionButtons = () => {
    const uploadModelsToCarButtonDisabled = selectedItems.length === 0;
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          onClick={() => {
            setSelectedItems([]);
          }}
        >
          {t('button.clear-selected')}
        </Button>
        <CarModelUploadModal
          disabled={uploadModelsToCarButtonDisabled}
          selectedModels={selectedItems}
          cars={cars}
        ></CarModelUploadModal>
      </SpaceBetween>
    );
  };

  return (
    <PageLayout
      helpPanelHidden={true}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-models' })}
          bodyContent={t('content', { ns: 'help-admin-models' })}
          footerContent={t('footer', { ns: 'help-admin-models' })}
        />
      }
      header={t('models.all-header')}
      description={t('models.list-of-all-uploaded-models')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('operator.breadcrumb'), href: '/admin/home' },
        { text: t('models.breadcrumb'), href: '/admin/home' },
        { text: t('models.all-breadcrumb') },
      ]}
    >
      <PageTable
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
        tableItems={allModels}
        columnConfiguration={columnConfiguration}
        selectionType="multi"
        header={
          <TableHeader
            nrSelectedItems={selectedItems.length}
            nrTotalItems={allModels.length}
            header={t('models.all-header')}
            actions={<HeaderActionButtons />}
          />
        }
        trackBy={'key'}
        itemsIsLoading={modelsIsLoading || carsIsLoading}
        loadingText={t('models.loading-models')}
        localStorageKey="models-table-preferences"
        filteringProperties={filteringProperties}
        filteringI18nStringsName="models"
      />
    </PageLayout>
  );
};

export { AdminModels };
