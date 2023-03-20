import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Container,
  Form,
  FormField,
  Header,
  Input,
  Link,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
  Toggle
} from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CountrySelector } from '../../components/countrySelector';
import { Flag } from '../../components/flag';
import { PageLayout } from '../../components/pageLayout';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines
} from '../../components/tableConfig';
import * as mutations from '../../graphql/mutations';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useUsersApi } from '../../hooks/useUsersApi';

import awsconfig from '../../config.json';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export function CreateUser() {
  const { t } = useTranslation();

  const [selectedItems] = useState([]);
  const [users, isLoading] = useUsersApi();
  const [preferences, setPreferences] = useLocalStorage('DREM-user-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['Username', 'Flag', 'UserCreateDate'],
  });
  const [username, setUsername] = useState('');
  const [usernameErrorText, setUsernameErrorText] = useState('');
  const [email, setEmail] = useState('');
  const [emailErrorText, setEmailErrorText] = useState('');
  const [termsAndConditionsErrorText, setTermsAndConditionsErrorText] = useState('');
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState('');
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [countryCode, setCountryCode] = useState('');

  async function createUserNow() {
    const apiResponse = await API.graphql({
      query: mutations.createUser,
      variables: {
        email: email,
        username: username,
        countryCode: countryCode,
      },
      authMode: 'AMAZON_COGNITO_USER_POOLS'
    });
    const response = apiResponse['data']['createUser'];
    console.log(response);
    setResult(response);
    setUsername('');
    setEmail('');
  }

  // watch checked Toggle for changes
  useEffect(() => {
    if (checked) {
      setTermsAndConditionsErrorText('');
    } else {
      setTermsAndConditionsErrorText(t('users.terms-and-conditions-error'));
    }
  }, [checked, t]);

  // watch properties for changes and enable generate button if required
  useEffect(() => {
    var regexFail = false;
    if (username.match(/^[a-zA-Z0-9-_]+$/) || username.match(/^$/)) {
      setUsernameErrorText('');
    } else {
      setUsernameErrorText('Does not match ^[a-zA-Z0-9-_]+$');
      regexFail = true;
    }

    if (email.match(/^[\w\.+-_]+@([\w-]+\.)+[\w-]{2,4}$/) || username.match(/^$/)) {
      setEmailErrorText('');
    } else {
      setEmailErrorText('Does not match ^[\\w\\.+-_]+@([\\w-]+\\.)+[\\w-]{2,4}$');
      regexFail = true;
    }

    if (username !== '' && email !== '' && regexFail !== true && checked && countryCode !== '') {
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
    return () => {
      // Unmounting
    };
  }, [username, email, checked, countryCode]);

  const columnsConfig = [
    {
      id: 'Username',
      header: t('users.header-username'),
      cell: (item) => item.Username || '-',
      sortingField: 'Username',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'Flag',
      header: t('users.flag'),
      cell: (item) => {
        const countryCode = item.Attributes.filter((obj) => {
          return obj.Name === 'custom:countryCode';
        });
        if (countryCode.length > 0) {
          return <Flag size="small" countryCode={countryCode[0].Value}></Flag>;
        } else {
          return '';
        }
      },
      sortingField: 'Flag',
      width: 120,
      minWidth: 80,
    },
    {
      id: 'CountryCode',
      header: t('users.country-code'),
      cell: (item) => {
        const countryCode = item.Attributes.filter((obj) => {
          return obj.Name === 'custom:countryCode';
        });
        if (countryCode.length > 0) {
          return countryCode[0].Value;
        } else {
          return '';
        }
      },
      sortingField: 'CountryCode',
      width: 120,
      minWidth: 80,
    },
    {
      id: 'UserCreateDate',
      header: t('users.header-creation-date'),
      cell: (item) => dayjs(item.UserCreateDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'UserCreateDate',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'UserLastModifiedDate',
      header: t('users.header-last-modified-date'),
      cell: (item) => dayjs(item.UserLastModifiedDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'UserLastModifiedDate',
      width: 200,
      minWidth: 150,
    },
  ];

  const visibleContentOptions = [
    {
      label: t('groups.information'),
      options: [
        {
          id: 'Username',
          label: t('users.header-username'),
          editable: false,
        },
        {
          id: 'Flag',
          label: t('users.flag'),
          //editable: false,
        },
        {
          id: 'CountryCode',
          label: t('users.country-code'),
          //editable: false,
        },
        {
          id: 'UserCreateDate',
          label: t('users.header-creation-date'),
        },
        {
          id: 'UserLastModifiedDate',
          label: t('users.header-last-modified-date'),
        },
      ],
    },
  ];

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(users, {
      filtering: {
        empty: (
          <EmptyState
            title={t('users.no-users')}
            subtitle={t('users.no-users-have-been-defined')}
          />
        ),
        noMatch: (
          <EmptyState
            title={t('models.no-matches')}
            subtitle={t('models.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>{t('models.clear-filter')}</Button>
            }
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: columnsConfig[3], isDescending: true } },
      selection: {},
    });

  return (
    <>
      <PageLayout
        header={t('users.header')}
        description={t('users.description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('topnav.registration'), href: '/registration' },
          { text: t('users.breadcrumb') },
        ]}
      >
        <SpaceBetween direction="vertical" size="l">
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="primary"
                  onClick={() => {
                    createUserNow();
                  }}
                  disabled={buttonDisabled}
                >
                  {t('users.create-user')}
                </Button>
              </SpaceBetween>
            }
          >
            <Container textAlign="center">
              <SpaceBetween direction="vertical" size="l">
                <FormField label={t('users.racer-name')} errorText={usernameErrorText}>
                  <Input
                    value={username}
                    placeholder={t('users.racer-name-placeholder')}
                    onChange={(input) => {
                      setUsername(input.detail.value);
                    }}
                  />
                </FormField>
                <FormField label={t('users.email')} errorText={emailErrorText}>
                  <Input
                    value={email}
                    placeholder={t('users.email-placeholder')}
                    onChange={(input) => {
                      setEmail(input.detail.value);
                    }}
                  />
                </FormField>

                <CountrySelector
                  countryCode={countryCode}
                  setCountryCode={setCountryCode}
                  label={t('users.country')}
                />
                <Flag countryCode={countryCode}></Flag>

                <FormField
                  label={t('users.terms-and-conditions-title')}
                  errorText={termsAndConditionsErrorText}
                >
                  <Link
                    href={awsconfig.Urls.termsAndConditionsUrl + '/terms-and-conditions.html'}
                    target="_blank"
                  >
                    {t('users.terms-and-conditions')}
                  </Link>
                  <Toggle
                    onChange={({ detail }) => setChecked(detail.checked)}
                    checked={checked}
                  ></Toggle>
                </FormField>
              </SpaceBetween>
            </Container>
          </Form>

          <Table
            {...collectionProps}
            header={
              <Header
                counter={
                  selectedItems.length
                    ? `(${selectedItems.length}/${users.length})`
                    : `(${users.length})`
                }
              >
                {t('users.header-list')}
              </Header>
            }
            columnDefinitions={columnsConfig}
            items={items}
            pagination={
              <Pagination
                {...paginationProps}
                ariaLabels={{
                  nextPageLabel: t('table.next-page'),
                  previousPageLabel: t('table.previous-page'),
                  pageLabel: (pageNumber) => `$(t{'table.go-to-page')} ${pageNumber}`,
                }}
              />
            }
            filter={
              <TextFilter
                {...filterProps}
                countText={MatchesCountText(filteredItemsCount)}
                filteringAriaLabel={t('users.filter-groups')}
              />
            }
            loading={isLoading}
            loadingText={t('users.loading-groups')}
            visibleColumns={preferences.visibleContent}
            selectedItems={selectedItems}
            stickyHeader="true"
            trackBy="GroupName"
            resizableColumns
            preferences={
              <CollectionPreferences
                title={t('table.preferences')}
                confirmLabel={t('button.confirm')}
                cancelLabel={t('button.cancel')}
                onConfirm={({ detail }) => setPreferences(detail)}
                preferences={preferences}
                pageSizePreference={PageSizePreference(t('users.page-size-label'))}
                visibleContentPreference={{
                  title: t('table.select-visible-colunms'),
                  options: visibleContentOptions,
                }}
                wrapLinesPreference={WrapLines}
              />
            }
          />
        </SpaceBetween>
      </PageLayout>
    </>
  );
}
