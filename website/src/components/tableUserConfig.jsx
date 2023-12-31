import { Checkbox, FormField } from '@cloudscape-design/components';
import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';
import { Flag } from './flag';

export const ColumnConfiguration = () => {
  return {
    defaultVisibleColumns: ['Username', 'Roles', 'UserStatus', 'UserCreateDate'],
    visibleContentOptions: [
      {
        label: i18next.t('users.information'),
        options: [
          {
            id: 'Username',
            label: i18next.t('users.header-username'),
            editable: false,
            alwaysVisible: true,
          },
          {
            id: 'Roles',
            label: i18next.t('users.role'),
            editable: false,
            alwaysVisible: true,
          },
          {
            id: 'Email',
            label: i18next.t('users.header-email'),
          },
          {
            id: 'UserStatus',
            label: i18next.t('users.status'),
          },
          {
            id: 'Flag',
            label: i18next.t('users.flag'),
          },
          {
            id: 'CountryCode',
            label: i18next.t('users.country-code'),
          },
          {
            id: 'UserCreateDate',
            label: i18next.t('users.header-creation-date'),
          },
          {
            id: 'UserLastModifiedDate',
            label: i18next.t('users.header-last-modified-date'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'Username',
        header: i18next.t('users.header-username'),
        cell: (item) => item.Username || '-',
        sortingField: 'Username',
        width: 250,
        minWidth: 200,
      },
      {
        id: 'Roles',
        header: i18next.t('users.role'),
        cell: (item) => item.Roles || '-',
        sortingField: 'Roles',
        width: 250,
        minWidth: 200,
      },
      {
        id: 'Email',
        header: i18next.t('users.header-email'),
        cell: (item) => item.Email || '-',
        sortingField: 'Email',
        width: 250,
        minWidth: 200,
      },
      {
        id: 'UserStatus',
        header: i18next.t('users.status'),
        cell: (item) => item.UserStatus || '-',
        sortingField: 'UserStatus',
        width: 250,
        minWidth: 200,
      },
      {
        id: 'Flag',
        header: i18next.t('users.flag'),
        cell: (item) => {
          if (item.CountryCode.length > 0) {
            return <Flag size="small" countryCode={item.CountryCode}></Flag>;
          } else {
            return '-';
          }
        },
        sortingField: 'Flag',
        width: 120,
        minWidth: 80,
      },
      {
        id: 'CountryCode',
        header: i18next.t('users.country-code'),
        cell: (item) => item.CountryCode || '-',
        sortingField: 'CountryCode',
        width: 120,
        minWidth: 80,
      },
      {
        id: 'UserCreateDate',
        header: i18next.t('users.header-creation-date'),
        cell: (item) => formatAwsDateTime(item.UserCreateDate) || '-',
        sortingField: 'UserCreateDate',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'UserLastModifiedDate',
        header: i18next.t('users.header-last-modified-date'),
        cell: (item) => formatAwsDateTime(item.UserLastModifiedDate) || '-',
        sortingField: 'UserLastModifiedDate',
        width: 200,
        minWidth: 150,
      },
    ],
  };
};

export const FilteringProperties = () => {
  return [
    {
      key: 'Username',
      propertyLabel: i18next.t('users.header-username'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'Roles',
      propertyLabel: i18next.t('users.role'),
      operators: [
        {
          operator: '=',
          form: ({ value, onChange }) => {
            const userRoles = [
              { value: 'admin', label: i18next.t('users.role.administrator') },
              { value: 'operator', label: i18next.t('users.role.operator') },
              { value: 'commentator', label: i18next.t('users.role.commentator') },
              { value: 'registration', label: i18next.t('users.role.registration') },
              { value: 'racer', label: i18next.t('users.role.racer') },
            ];
            return (
              <FormField>
                {userRoles.map((option, i) => (
                  <Checkbox
                    key={i}
                    checked={(value || []).includes(option.value)}
                    onChange={(event) => {
                      const newValue = [...(value || [])];
                      if (event.detail.checked) {
                        newValue.push(option.value);
                      } else {
                        newValue.splice(newValue.indexOf(option.value), 1);
                      }
                      onChange(newValue);
                    }}
                  >
                    {option.label}
                  </Checkbox>
                ))}
              </FormField>
            );
          },
          format: (values) => (values || []).join(', '),
        },
      ],
    },
    {
      key: 'Email',
      propertyLabel: i18next.t('users.header-email'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
