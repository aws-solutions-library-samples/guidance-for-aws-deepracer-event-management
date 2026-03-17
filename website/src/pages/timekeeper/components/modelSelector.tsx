import { Box, SpaceBetween, Toggle } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageTable } from '../../../components/pageTable';
import { TableHeader } from '../../../components/tableConfig';
import {
  ColumnConfigurationOperator,
  FilteringPropertiesOperator,
} from '../../../components/tableModelsConfigOperator';
import { useStore } from '../../../store/store';

interface QueryToken {
  propertyKey?: string;
  value?: string;
  operator?: string;
}

interface Query {
  tokens: QueryToken[];
  operation: 'and' | 'or';
}

interface Model {
  modelId: string;
  status: string;
  uploadedDateTime: string;
}

interface ModelSelectorProps {
  query?: Query;
  selectedModels: Model[];
  setSelectedModels: (models: Model[]) => void;
  clearModelsOnCarToggle: boolean;
  setClearModelsOnCarToggle: (value: boolean) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  query = { tokens: [], operation: 'and' },
  selectedModels,
  setSelectedModels,
  clearModelsOnCarToggle,
  setClearModelsOnCarToggle
}) => {
  const { t } = useTranslation([
    'translation',
    'help-model-management',
    'help-admin-model-management',
  ]);
  const columnConfiguration = ColumnConfigurationOperator();
  const filteringProperties = FilteringPropertiesOperator();
  const [state] = useStore() as any; // TODO: Type store properly
  const models: Model[] = state.models.models;
  const isLoading: boolean = state.models.isLoading;

  let tabeleHeaderContent = (
    <TableHeader
      nrSelectedItems={selectedModels.length}
      nrTotalItems={models.length}
      header={t('models.models')}
    />
  );

  let tabeleFooterContent = (
    <SpaceBetween direction='vertical' size='s'>
      <Box float='right'>
        <Toggle
          onChange={({ detail }) => {
            setClearModelsOnCarToggle(detail.checked);
          }}
          checked={clearModelsOnCarToggle}
        >
          {t('carmodelupload.clear')}
        </Toggle>
      </Box>
    </SpaceBetween>
  );

  const content = (
    <PageTable
      selectedItems={selectedModels}
      setSelectedItems={setSelectedModels}
      tableItems={models}
      selectionType="multi"
      columnConfiguration={columnConfiguration as any}
      trackBy="modelId"
      sortingColumn={{ sortingField: 'uploadedDateTime' } as any}
      header={tabeleHeaderContent}
      footer={tabeleFooterContent}
      itemsIsLoading={isLoading}
      isItemDisabled={(item: Model) => !['AVAILABLE', 'OPTIMIZED'].includes(item.status)}
      loadingText={t('models.loading-models')}
      localStorageKey="models-table-preferences"
      filteringProperties={filteringProperties as any}
      filteringI18nStringsName="models"
      query={query as any}
    />
  );

  return content;
};
