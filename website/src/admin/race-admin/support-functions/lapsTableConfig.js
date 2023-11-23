import { Input, Select } from '@cloudscape-design/components';
import i18next from '../../../i18n';
import { convertMsToString } from '../../../support-functions/time';

export const ColumnConfiguration = (isEditable) => {
  const columnDefinitions = isEditable ? EditableColumnDefinitions() : ColumnDefinitions();

  return {
    defaultVisibleColumns: [['lapId', 'time', 'resets', 'isValid']],
    visibleContentOptions: [
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
            id: 'avgTime',
            label: i18next.t('race-admin.avg-time'),
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
    ],
    columnDefinitions: columnDefinitions,
  };
};

export const ColumnDefinitions = () => {
  return [
    {
      id: 'lapId',
      header: i18next.t('race-admin.lap-id'),
      cell: (item) => item.lapId || '-',
      sortingField: 'lapId',
      sortingComparator: (a, b) => (a.lapId > b.labId ? 1 : -1),
      width: 100,
    },
    {
      id: 'time',
      header: i18next.t('race-admin.time'),
      cell: (item) => convertMsToString(item.time) || '-',
      sortingField: 'time',
      width: 200,
    },
    {
      id: 'avgTime',
      header: i18next.t('race-admin.avg-time'),
      cell: (item) => (item.avgTime ? convertMsToString(item.avgTime) : '-'),
      sortingField: 'avgTime',
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
      cell: (item) =>
        item.isValid
          ? i18next.t('timekeeper.lap-table.valid')
          : i18next.t('timekeeper.lap-table.not-valid'),
      sortingField: 'isValid',
      width: 176,
    },
    {
      id: 'autTimeConnected',
      header: i18next.t('race-admin.aut-timer-connected'),
      cell: (item) =>
        item.autTimeConnected
          ? i18next.t('timekeeper.race-page.automated-timer-connected')
          : i18next.t('timekeeper.race-page.automated-timer-not-connected'),
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
      cell: (item) => convertMsToString(item.time) || '-',
      sortingField: 'time',
      width: 230,
      editConfig: {
        ariaLabel: 'Time',
        editIconAriaLabel: 'editable',
        errorIconAriaLabel: 'Time Error',
        editingCell: (item, { currentValue, setValue }) => {
          return (
            <Input
              autoFocus={true}
              value={currentValue ?? convertMsToString(item.time)}
              onChange={(event) => setValue(event.detail.value)}
            />
          );
        },
        validation: (item, value) => {
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
      id: 'avgTime',
      header: i18next.t('race-admin.avg-time'),
      cell: (item) => (item.avgTime ? convertMsToString(item.avgTime) : '-'),
      sortingField: 'avgTime',
      width: 200,
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
          return (
            <Input
              autoFocus={true}
              value={currentValue ?? item.resets}
              onChange={(event) => setValue(event.detail.value)}
            />
          );
        },
        validation: (item, value) => {
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
      cell: (item) =>
        item.isValid
          ? i18next.t('timekeeper.lap-table.valid')
          : i18next.t('timekeeper.lap-table.not-valid'),
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
                  { label: i18next.t('timekeeper.lap-table.valid'), value: true },
                  { label: i18next.t('timekeeper.lap-table.not-valid'), value: false },
                ].find((option) => option.value === value) ?? null
              }
              onChange={(event) => {
                setValue(event.detail.selectedOption.value ?? item.isValid);
              }}
              options={[
                { label: i18next.t('timekeeper.lap-table.valid'), value: true },
                { label: i18next.t('timekeeper.lap-table.not-valid'), value: false },
              ]}
            />
          );
        },
      },
    },
    {
      id: 'autTimeConnected',
      header: i18next.t('race-admin.aut-timer-connected'),
      cell: (item) =>
        item.autTimeConnected
          ? i18next.t('timekeeper.automated-timer-msg-connected')
          : i18next.t('timekeeper.automated-timer-msg-not-connected'),
      sortingField: 'autTimeConnected',
    },
  ];
};
