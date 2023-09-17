import i18next from '../i18n';

export const ColumnConfiguration = () => {
  return {
    defaultVisibleColumns: ['modelName', 'modelDate'],
    visibleContentOptions: [
      {
        label: i18next.t('models.model-information'),
        options: [
          {
            id: 'modelName',
            label: i18next.t('models.model-name'),
            editable: false,
          },
          {
            id: 'modelDate',
            label: i18next.t('models.upload-date'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'modelName',
        header: i18next.t('models.model-name'),
        cell: (item) => item.modelName || '-',
        sortingField: 'modelName',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'modelDate',
        header: i18next.t('models.upload-date'),
        cell: (item) => item.modelDate || '-',
        sortingField: 'modelDate',
        width: 240,
        minWidth: 150,
      },
    ],
  };
};

// Default FilterProps unless other is required for a given role
export const FilteringProperties = () => {
  return [
    {
      key: 'modelName',
      propertyLabel: i18next.t('models.model-name'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
