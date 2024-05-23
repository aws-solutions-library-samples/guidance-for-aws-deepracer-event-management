import React, { useState } from 'react';
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
  setSelectedModels
}) => {
  const { t } = useTranslation([
    'translation',
    'help-model-management',
    'help-admin-model-management',
  ]);
  const [columnConfiguration, setColumnConfiguration] = useState(ColumnConfigurationOperator());
  const [filteringProperties, setFilteringProperties] = useState(FilteringPropertiesOperator());
  // const [selectedModels, setSelectedModels] = useState([]);
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
