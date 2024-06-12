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

export const ModelSelector = ({
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
  const [state] = useStore();
  const models = state.models.models;
  const isLoading = state.models.isLoading;

  let tabeleHeaderContent = (
    <TableHeader
      nrSelectedItems={selectedModels.length}
      nrTotalItems={models.length}
      header={t('models.models')}
    />
  );

  let tabeleFooterContent = (
    <SpaceBetween direction='vertical'>
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
      columnConfiguration={columnConfiguration}
      trackBy="modelId"
      sortingColumn="uploadedDateTime"
      header={tabeleHeaderContent}
      footer={tabeleFooterContent}
      itemsIsLoading={isLoading}
      isItemDisabled={(item) => !['AVAILABLE', 'OPTIMIZED'].includes(item.status)}
      loadingText={t('models.loading-models')}
      localStorageKey="models-table-preferences"
      filteringProperties={filteringProperties}
      filteringI18nStringsName="models"
      query={query}
    />
  );

  return content;
};
