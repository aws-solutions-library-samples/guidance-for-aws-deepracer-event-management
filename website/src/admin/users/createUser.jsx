import {
  Button,
  Checkbox,
  Container,
  Form,
  FormField,
  Grid,
  Input,
  Link,
  SpaceBetween,
} from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CountrySelector } from '../../components/countrySelector';
import { Flag } from '../../components/flag';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import * as mutations from '../../graphql/mutations';

import { useStore } from '../../store/store';

const notificationId = 'create_user';
export function CreateUser() {
  const { t } = useTranslation(['translation', 'help-admin-create-user']);

  const [username, setUsername] = useState('');
  const [usernameErrorText, setUsernameErrorText] = useState('');
  const [email, setEmail] = useState('');
  const [emailErrorText, setEmailErrorText] = useState('');
  const [tncChecked, setTncChecked] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [, dispatch] = useStore();

  async function createUserNow() {
    setButtonDisabled(true);
    dispatch('ADD_NOTIFICATION', {
      type: 'success',
      loading: true,
      content: t('users.notifications.creating-user', { username }),
      id: notificationId,
      dismissible: true,
      onDismiss: () => {
        dispatch('DISMISS_NOTIFICATION', notificationId);
      },
    });
    try {
      const apiResponse = await API.graphql({
        query: mutations.createUser,
        variables: {
          email: email,
          username: username,
          countryCode: countryCode,
        },
        authMode: 'AMAZON_COGNITO_USER_POOLS',
      });
      const response = apiResponse['data']['createUser'];
      console.debug(response);

      dispatch('ADD_NOTIFICATION', {
        type: 'success',
        content: t('users.notifications.user-created', { username }),
        id: notificationId,
        dismissible: true,
        onDismiss: () => {
          dispatch('DISMISS_NOTIFICATION', notificationId);
        },
      });

      setUsername('');
      setEmail('');
      setCountryCode('');
      setTncChecked(false);
    } catch (response) {
      const errorMessage = response.errors[0].message;

      dispatch('ADD_NOTIFICATION', {
        type: 'error',
        content: t('users.notifications.user-not-created', { username, errorMessage }),
        id: notificationId,
        dismissible: true,
        onDismiss: () => {
          dispatch('DISMISS_NOTIFICATION', notificationId);
        },
      });
    } finally {
      setButtonDisabled(false);
    }
  }

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

    if (username !== '' && email !== '' && regexFail !== true && tncChecked && countryCode !== '') {
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
    return () => {
      // Unmounting
    };
  }, [username, email, tncChecked, countryCode]);

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-create-user' })}
          bodyContent={t('content', { ns: 'help-admin-create-user' })}
          footerContent={t('footer', { ns: 'help-admin-create-user' })}
        />
      }
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
              <Grid gridDefinition={[{ colspan: 7 }, { colspan: 1 }]}>
                <CountrySelector
                  countryCode={countryCode}
                  setCountryCode={setCountryCode}
                  label={t('users.country')}
                />
                <Flag countryCode={countryCode}></Flag>
              </Grid>
              <FormField
                label={t('users.terms-and-conditions-title')}
                errorText={tncChecked ? '' : t('users.terms-and-conditions-error')}
              >
                <Checkbox
                  onChange={({ detail }) => setTncChecked(detail.checked)}
                  checked={tncChecked}
                >
                  <Link href={'/terms-and-conditions.html'} target="_blank">
                    {t('users.terms-and-conditions')}
                  </Link>
                </Checkbox>
              </FormField>
            </SpaceBetween>
          </Container>
        </Form>
      </SpaceBetween>
    </PageLayout>
  );
}
