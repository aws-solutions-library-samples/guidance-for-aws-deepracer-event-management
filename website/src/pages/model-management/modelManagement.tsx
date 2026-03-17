import { Button, SpaceBetween } from '@cloudscape-design/components';
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
import { getCurrentAuthUser } from '../../hooks/useAuth';
import { useStore } from '../../store/store';
import { CarModelUploadModal } from './components/carModelUploadModal';
import { DeleteModelModal } from './components/deleteModelModal';
import { ModelUpload } from './components/modelUpload';

interface Breadcrumb {
  text: string;
  href?: string;
}

interface ModelManagementProps {
  isOperatorView?: boolean;
  onlyDisplayOwnModels?: boolean;
}

export const ModelManagement: React.FC<ModelManagementProps> = ({ 
  isOperatorView = false, 
  onlyDisplayOwnModels = true 
}) => {
  const { t } = useTranslation([
    'translation',
    'help-model-management',
    'help-admin-model-management',
  ]);
  const [columnConfiguration, setColumnConfiguration] = useState(ColumnConfigurationOperator());
  const [filteringProperties, setFilteringProperties] = useState(FilteringPropertiesOperator());
  const [selectedModels, setSelectedModels] = useState<any[]>([]); // TODO: Update Model interface to include sub, status properties
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]); // TODO: Define proper Breadcrumb type matching PageLayout expectations
  const [state] = useStore();
  const [, dispatch] = useStore();
  const models = state.models?.models || [];
  const isLoading = state.models?.isLoading || false;
  const [currentUserSub, setCurrentUserSub] = useState<string>('')

  useEffect(() => {
    getCurrentAuthUser().then((authUser) => {
      setCurrentUserSub(authUser.sub);
    }).catch(() => {
      setCurrentUserSub('');
    });
  }, []);

  // based on onlyDisplayOwnModels select if only the users own models should be displayed or all available models
  const modelsToDisplay = onlyDisplayOwnModels
    ? models.filter((model: any) => model.sub === currentUserSub)
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
      setColumnConfiguration(ColumnConfigurationRacer() as any);
      setFilteringProperties(FilteringPropertiesRacer());
      setBreadcrumbs([{ text: t('home.breadcrumb'), href: '/' }, { text: t('models.breadcrumb') }]);
      dispatch('UPDATE_HELP_PANEL', {
        isHidden: false,
        content: helpPanel,
      });
      dispatch('HELP_PANEL_IS_OPEN', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOperatorView, t, dispatch]);

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
      <CarModelUploadModal modelsToUpload={selectedModels} />
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

  const TableHeaderAny = TableHeader as any;
  const tableHeader: React.ReactNode = (
    <TableHeaderAny
      nrSelectedItems={selectedModels.length}
      nrTotalItems={modelsToDisplay.length}
      header={t('models.header')}
      actions={isOperatorView ? operatorActionButtons : actionButtons}
    />
  );

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={isOperatorView ? operatorHelpPanel : helpPanel}
      header={t('models.header')}
      description={isOperatorView ? t('models.operator.description') : t('models.description')}
      breadcrumbs={breadcrumbs}
    >
      <PageTable<any>
        selectedItems={selectedModels}
        setSelectedItems={setSelectedModels}
        tableItems={modelsToDisplay}
        selectionType="multi"
        columnConfiguration={columnConfiguration as any}
        trackBy="modelId"
        sortingColumn={{ sortingField: 'uploadedDateTime' } as any}
        header={tableHeader}
        itemsIsLoading={isLoading}
        isItemDisabled={(item: any) => !['AVAILABLE', 'OPTIMIZED'].includes(item.status)}
        loadingText={t('models.loading-models')}
        localStorageKey="models-table-preferences"
        filteringProperties={filteringProperties as any}
        filteringI18nStringsName="models"
      />
    </PageLayout>
  );
};
