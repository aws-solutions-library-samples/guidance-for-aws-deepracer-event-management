import { Input, Select } from '@cloudscape-design/components';
import i18next from '../../../i18n';

export const VisibleContentOptions = () => {
  return [
    {
      label: i18next.t('race-admin.information'),
      options: [
        {
          id: 'lapId',
          label: i18next.t('race-admin.lap-id'),
        },
        {
          id: 'time',
          label: i18next.t('race-admin.time'),
        },
        {
          id: 'resets',
          label: i18next.t('race-admin.resets'),
        },
        {
          id: 'isValid',
          label: i18next.t('race-admin.is-valid'),
        },
        {
          id: 'autTimeConnected',
          label: i18next.t('race-admin.aut-timer-connected'),
        },
      ],
    },
  ];
};

export const ColumnDefinitions = () => {
  return [
    {
      id: 'lapId',
      header: i18next.t('race-admin.lap-id'),
      cell: (item) => item.lapId || '-',
      sortingField: 'lapId',
      width: 100,
    },
    {
      id: 'time',
      header: i18next.t('race-admin.time'),
      cell: (item) => item.timeHr || '-',
      sortingField: 'time',
      width: 200,
    },
    {
      id: 'resets',
      header: i18next.t('race-admin.resets'),
      cell: (item) => (item.resets ? item.resets : 0),
      sortingField: 'resets',
      width: 176,
    },
    {
      id: 'isValid',
      header: i18next.t('race-admin.is-valid'),
      cell: (item) => (item.isValid ? 'Valid' : 'Not Valid'),
      sortingField: 'isValid',
      width: 176,
    },
    {
      id: 'autTimeConnected',
      header: i18next.t('race-admin.aut-timer-connected'),
      cell: (item) => (item.autTimeConnected ? 'Connected' : 'Not Connected'),
      sortingField: 'autTimeConnected',
    },
  ];
};

export const EditableColumnDefinitions = () => {
  return [
    {
      id: 'lapId',
      header: i18next.t('race-admin.lap-id'),
      cell: (item) => item.lapId || '-',
      sortingField: 'lapId',
      width: 100,
    },
    {
      id: 'time',
      header: i18next.t('race-admin.time'),
      cell: (item) => item.timeHr || '-',
      sortingField: 'time',
      width: 230,
      editConfig: {
        ariaLabel: 'Time',
        editIconAriaLabel: 'editable',
        errorIconAriaLabel: 'Time Error',
        editingCell: (item, { currentValue, setValue }) => {
          console.info(currentValue);
          console.info(item);
          return (
            <Input
              autoFocus={true}
              value={currentValue ?? item.timeHr}
              onChange={(event) => setValue(event.detail.value)}
            />
          );
        },
        validation: (item, value) => {
          console.info(item);
          console.info(value);
          if (value === undefined) return undefined;
          const regExpression = '[0-5]{1}\\d{1}:[0-5]{1}\\d{1}\\.\\d{3}$';
          const regex = new RegExp(regExpression);
          if (regex.test(value)) {
            return undefined;
          }
          return regExpression;
        },
      },
    },
    {
      id: 'resets',
      header: i18next.t('race-admin.resets'),
      cell: (item) => (item.resets ? item.resets : 0),
      sortingField: 'resets',
      width: 176,
      editConfig: {
        ariaLabel: 'Resets',
        editIconAriaLabel: 'editable',
        errorIconAriaLabel: 'Reset Error',
        editingCell: (item, { currentValue, setValue }) => {
          console.info(currentValue);
          return (
            <Input
              autoFocus={true}
              value={currentValue ?? item.resets}
              onChange={(event) => setValue(event.detail.value)}
            />
          );
        },
        validation: (item, value) => {
          console.info(item);
          console.info(value);
          if (value === undefined) return undefined;
          const regExpression = '^[0-9]+$';
          const regex = new RegExp(regExpression);
          if (regex.test(value)) {
            return undefined;
          }
          return regExpression;
        },
      },
    },
    {
      id: 'isValid',
      header: i18next.t('race-admin.is-valid'),
      cell: (item) => (item.isValid ? 'Valid' : 'Not Valid'),
      sortingField: 'isValid',
      width: 220,
      editConfig: {
        ariaLabel: 'Is Valid',
        editIconAriaLabel: 'editable',
        errorIconAriaLabel: 'Error',
        editingCell: (item, { currentValue, setValue }) => {
          const value = currentValue ?? item.isValid;
          return (
            <Select
              autoFocus={true}
              expandToViewport={true}
              selectedOption={
                [
                  { label: 'Valid', value: true },
                  { label: 'Not Valid', value: false },
                ].find((option) => option.value === value) ?? null
              }
              onChange={(event) => {
                setValue(event.detail.selectedOption.value ?? item.isValid);
              }}
              options={[
                { label: 'Valid', value: true },
                { label: 'Not Valid', value: false },
              ]}
            />
          );
        },
      },
    },
    {
      id: 'autTimeConnected',
      header: i18next.t('race-admin.aut-timer-connected'),
      cell: (item) => (item.autTimeConnected ? 'Connected' : 'Not Connected'),
      sortingField: 'autTimeConnected',
    },
  ];
};
