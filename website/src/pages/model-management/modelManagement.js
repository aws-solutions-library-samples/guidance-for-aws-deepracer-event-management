import { Button, SpaceBetween } from '@cloudscape-design/components';
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
  const { t } = useTranslation([
    'translation',
    'help-model-management',
    'help-admin-model-management',
  ]);
  const [columnConfiguration, setColumnConfiguration] = useState(ColumnConfigurationOperator());
  const [filteringProperties, setFilteringProperties] = useState(FilteringPropertiesOperator());
  const [selectedModels, setSelectedModels] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [state] = useStore();
  const [, dispatch] = useStore();
  const models = state.models.models;
  const isLoading = state.models.isLoading;

  // based on onlyDisplayOwnModels select if only the users own models should be displayed or all available models
  const modelsToDisplay = onlyDisplayOwnModels
    ? models.filter((model) => model.sub === Auth.user.attributes.sub)
    : models;

  const operatorHelpPanel = (
    <SimpleHelpPanelLayout
      headerContent={t('header', { ns: 'help-admin-model-management' })}
      bodyContent={t('content', { ns: 'help-admin-model-management' })}
      footerContent={t('footer', { ns: 'help-admin-model-management' })}
    />
  );

  const helpPanel = (
    <SimpleHelpPanelLayout
      headerContent={t('header', { ns: 'help-model-management' })}
      bodyContent={t('content', { ns: 'help-model-management' })}
      footerContent={t('footer', { ns: 'help-model-management' })}
    />
  );

  // based on isOperatorView select if the operator view should be displayed or the racer view
  useEffect(() => {
    if (isOperatorView) {
      setColumnConfiguration(ColumnConfigurationOperator());
      setFilteringProperties(FilteringPropertiesOperator());
      setBreadcrumbs([
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('operator.breadcrumb'), href: '/admin/home' },
        { text: t('models.breadcrumb'), href: '/admin/home' },
        { text: t('models.models.breadcrumb') },
      ]);
      dispatch('UPDATE_HELP_PANEL', {
        isHidden: false,
        content: operatorHelpPanel,
      });
      dispatch('HELP_PANEL_IS_OPEN', false);
    } else {
      setColumnConfiguration(ColumnConfigurationRacer());
      setFilteringProperties(FilteringPropertiesRacer());
      setBreadcrumbs([{ text: t('home.breadcrumb'), href: '/' }, { text: t('models.breadcrumb') }]);
      dispatch('UPDATE_HELP_PANEL', {
        isHidden: false,
        content: helpPanel,
      });
      dispatch('HELP_PANEL_IS_OPEN', false);
    }
  }, [isOperatorView]);

  const removeModelHandler = () => {
    setSelectedModels([]);
  };

  const clearSelectedModelsHandler = () => {
    setSelectedModels([]);
  };

  const operatorActionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <Button disabled={selectedModels.length === 0} onClick={clearSelectedModelsHandler}>
        {t('button.clear-selected')}
      </Button>
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
      helpPanelContent={isOperatorView ? operatorHelpPanel : helpPanel}
      header={t('models.header')}
      description={isOperatorView ? t('models.operator.description') : t('models.description')}
      breadcrumbs={breadcrumbs}
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
        isItemDisabled={(item) => !['AVAILABLE', 'OPTIMIZED'].includes(item.status)}
        loadingText={t('models.loading-models')}
        localStorageKey="models-table-preferences"
        filteringProperties={filteringProperties}
        filteringI18nStringsName="models"
      />
    </PageLayout>
  );
};
