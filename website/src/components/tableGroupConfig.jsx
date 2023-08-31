// import { Calendar, DateInput, FormField, Link } from '@cloudscape-design/components';
import { Link } from '@cloudscape-design/components';
import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';

export const ColumnDefinitions = () => {
  return [
    {
      id: 'groupName',
      header: i18next.t('groups.header-name'),
      cell: (item) => (
        <div>
          <Link href={window.location.href + '/' + item.GroupName}>{item.GroupName}</Link>
        </div>
      ),
      sortingField: 'groupName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'description',
      header: i18next.t('groups.header-description'),
      cell: (item) => item.Description || '-',
      sortingField: 'description',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'creationDate',
      header: i18next.t('groups.header-creation-date'),
      cell: (item) => formatAwsDateTime(item.creationDate) || '-',
      sortingField: 'creationDate',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'lastModifiedDate',
      header: i18next.t('groups.header-last-modified-date'),
      cell: (item) => formatAwsDateTime(item.LastModifiedDate) || '-',
      sortingField: 'lastModifiedDate',
      width: 200,
      minWidth: 150,
    },
  ];
};

export const VisibleContentOptions = () => {
  return [
    {
      label: i18next.t('groups.information'),
      options: [
        {
          id: 'GroupName',
          label: i18next.t('groups.header-name'),
          editable: false,
        },
        {
          id: 'description',
          label: i18next.t('groups.header-description'),
          editable: false,
        },
        {
          id: 'creationDate',
          label: i18next.t('groups.header-creation-date'),
        },
        {
          id: 'lastModifiedDate',
          label: i18next.t('groups.header-last-modified-date'),
        },
      ],
    },
  ];
};

export const FilteringProperties = () => {
  return [
    {
      key: 'groupName',
      propertyLabel: i18next.t('groups.header-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'Description',
      propertyLabel: i18next.t('groups.header-description'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
