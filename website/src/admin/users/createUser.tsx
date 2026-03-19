import {
  Button,
  Container,
  Form,
  FormField,
  Grid,
  Input,
  SpaceBetween,
} from '@cloudscape-design/components';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CountrySelector } from '../../components/countrySelector';
import { Flag } from '../../components/flag';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { graphqlMutate } from '../../graphql/graphqlHelpers';
import * as mutations from '../../graphql/mutations';

import { useStore } from '../../store/store';

const notificationId = 'create_user';

/**
 * CreateUser component for creating new users with email and username
 * Includes validation for username and email format
 */
export function CreateUser(): JSX.Element {
  const { t } = useTranslation(['translation', 'help-admin-create-user']);

  const [username, setUsername] = useState<string>('');
  const [usernameErrorText, setUsernameErrorText] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [emailErrorText, setEmailErrorText] = useState<string>('');
  const [buttonDisabled, setButtonDisabled] = useState<boolean>(false);
  const [countryCode, setCountryCode] = useState<string>('');
  const [, dispatch] = useStore();

  async function createUserNow(): Promise<void> {
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
    } as any);
    try {
      const apiResponse = await graphqlMutate<{ createUser: any }>(
        mutations.createUser,
        { email, username, countryCode },
        { authMode: 'userPool' }
      );
      const response = apiResponse.createUser;
      console.debug(response);

      dispatch('ADD_NOTIFICATION', {
        type: 'success',
        content: t('users.notifications.user-created', { username }),
        id: notificationId,
        dismissible: true,
        onDismiss: () => {
          dispatch('DISMISS_NOTIFICATION', notificationId);
        },
      } as any);

      setUsername('');
      setEmail('');
      setCountryCode('');
    } catch (response: any) {
      const errorMessage = response.errors[0].message;

      dispatch('ADD_NOTIFICATION', {
        type: 'error',
        content: t('users.notifications.user-not-created', { username, errorMessage }),
        id: notificationId,
        dismissible: true,
        onDismiss: () => {
          dispatch('DISMISS_NOTIFICATION', notificationId);
        },
      } as any);
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

    if (username !== '' && email !== '' && regexFail !== true && countryCode !== '') {
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
    return () => {
      // Unmounting
    };
  }, [username, email, countryCode]);

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
        { text: t('users.breadcrumb'), href: '#' },
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
          <Container {...({ textAlign: "center" } as any)}>
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
            </SpaceBetween>
          </Container>
        </Form>
      </SpaceBetween>
    </PageLayout>
  );
}
