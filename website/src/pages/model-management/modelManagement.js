import { SpaceBetween } from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';
import { TableHeader } from '../../components/tableConfig';
import {
  ColumnConfigurationOperator,
  FilteringPropertiesOperator,
} from '../../components/tableModelsConfigOperator';
import {
  ColumnConfigurationRacer,
  FilteringPropertiesRacer,
} from '../../components/tableModelsConfigRacer';
import { useStore } from '../../store/store';
import { CarModelUploadModal } from './components/carModelUploadModal';
import { DeleteModelModal } from './components/deleteModelModal';
import { ModelUpload } from './components/modelUpload';

export const ModelManagement = ({ isOperatorView = false, onlyDisplayOwnModels = true }) => {
  const { t } = useTranslation(['translation', 'help-model-management']);
  const [columnConfiguration, setColumnConfiguration] = useState(ColumnConfigurationRacer());
  const [filteringProperties, setFilteringProperties] = useState(FilteringPropertiesRacer());
  const [selectedModels, setSelectedModels] = useState([]);
  const [state] = useStore();
  const models = state.models.models;
  const isLoading = state.models.isLoading;

  // based on onlyDisplayOwnModels select if only the users own models should be displayed or all available models
  const modelsToDisplay = onlyDisplayOwnModels
    ? models.filter((model) => model.sub === Auth.user.attributes.sub)
    : models;
  // TODO why is not useEffect on models work??????
  // useEffect(() => {
  //   console.info('UPDATING OWN MODELS TRIGGERED', models);
  //   if (onlyDisplayOwnModels) {
  //     const usersOwnModels = models.filter((model) => model.sub === Auth.user.attributes.sub);
  //     console.info('UPDATING OWN MODELS:', usersOwnModels);
  //     setModelsToDisplay(usersOwnModels);
  //   } else {
  //     setModelsToDisplay(models);
  //   }
  // }, [models, onlyDisplayOwnModels]);

  // based on isOperatorView select if the operator view should be displayed or the racer view
  useEffect(() => {
    if (isOperatorView) {
      setColumnConfiguration(ColumnConfigurationOperator());
      setFilteringProperties(FilteringPropertiesOperator());
    } else {
      setColumnConfiguration(ColumnConfigurationRacer());
      setFilteringProperties(FilteringPropertiesRacer());
    }
  }, [isOperatorView]);

  const removeModelHandler = () => {
    setSelectedModels([]);
  };

  const operatorActionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <CarModelUploadModal modelsToUpload={selectedModels} uploadDisabled={selectedModels === 0} />
    </SpaceBetween>
  );

  const actionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <ModelUpload />
      <DeleteModelModal
        disabled={selectedModels.length === 0}
        selectedModels={selectedModels}
        onDelete={removeModelHandler}
        variant="primary"
      />
    </SpaceBetween>
  );

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-model-management' })}
          bodyContent={t('content', { ns: 'help-model-management' })}
          footerContent={t('footer', { ns: 'help-model-management' })}
        />
      }
      header={t('models.header')}
      breadcrumbs={[{ text: t('home.breadcrumb'), href: '/' }, { text: t('models.breadcrumb') }]}
    >
      <PageTable
        selectedItems={selectedModels}
        setSelectedItems={setSelectedModels}
        tableItems={modelsToDisplay}
        selectionType="multi"
        columnConfiguration={columnConfiguration}
        trackBy="modelId"
        sortingColumn="uploadedDateTime"
        header={
          <TableHeader
            nrSelectedItems={selectedModels.length}
            nrTotalItems={modelsToDisplay.length}
            header={t('models.header')}
            actions={isOperatorView ? operatorActionButtons : actionButtons}
          />
        }
        itemsIsLoading={isLoading}
        isItemDisabled={(item) => item.status !== 'AVAILABLE'}
        loadingText={t('models.loading-models')}
        localStorageKey="models-table-preferences"
        filteringProperties={filteringProperties}
        filteringI18nStringsName="models"
      />
    </PageLayout>
  );
};
