import i18next from '../i18n';

export const ColumnConfiguration = () => {
  return {
    defaultVisibleColumns: ['userName', 'modelName', 'modelDate'],
    visibleContentOptions: [
      {
        label: i18next.t('models.model-information'),
        options: [
          {
            id: 'modelId',
            label: i18next.t('models.model-id'),
          },
          {
            id: 'userName',
            label: i18next.t('models.user-name'),
            editable: false,
          },
          {
            id: 'modelName',
            label: i18next.t('models.model-name'),
            editable: false,
          },
          {
            id: 'modelDate',
            label: i18next.t('models.upload-date'),
          },
          {
            id: 'modelMD5Hash',
            label: i18next.t('models.md5-hash'),
          },
          {
            id: 'modelMetadataMD5Hash',
            label: i18next.t('models.md5-hash-metadata'),
          },
          {
            id: 'modelS3Key',
            label: i18next.t('models.model-s3-key'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'modelId',
        header: i18next.t('models.model-id'),
        cell: (item) => item.modelId,
        width: 320,
      },
      {
        id: 'userName',
        header: i18next.t('models.user-name'),
        cell: (item) => item.userName || '-',
        sortingField: 'userName',
        width: 200,
        minWidth: 150,
      },
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
      {
        id: 'modelMD5Hash',
        header: i18next.t('models.md5-hash'),
        cell: (item) => item.modelMD5,
        width: 200,
        minWidth: 150,
      },
      {
        id: 'modelMetadataMD5Hash',
        header: i18next.t('models.md5-hash-metadata'),
        cell: (item) => item.modelMetadataMD5,
        width: 200,
        minWidth: 150,
      },
      {
        id: 'modelS3Key',
        header: i18next.t('models.model-s3-key'),
        cell: (item) => item.modelKey,
        width: 200,
        minWidth: 150,
      },
    ],
  };
};

export const FilteringProperties = () => {
  return [
    {
      key: 'userName',
      propertyLabel: i18next.t('models.user-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'modelName',
      propertyLabel: i18next.t('models.model-name'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
