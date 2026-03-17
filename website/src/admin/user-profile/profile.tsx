import ColumnLayout from '@cloudscape-design/components/column-layout';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageLayout } from '../../components/pageLayout';

import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';

import { graphqlMutate } from '../../graphql/graphqlHelpers';
import * as mutations from '../../graphql/mutations';
import { authChangePassword, authSignOut, getCurrentAuthUser } from '../../hooks/useAuth';

import {
  Box,
  Button,
  Form,
  FormField,
  Input,
  Modal,
  SpaceBetween,
} from '@cloudscape-design/components';

interface ProfileHomeProps {
  // No props currently used
}

const ProfileHome: React.FC<ProfileHomeProps> = (props) => {
  const { t } = useTranslation();

  const [username, setUsername] = useState<string | undefined>();
  const [identityId, setIdentityId] = useState<string | undefined>();
  const [deleteUserModalVisible, setDeleteUserModalVisible] = useState<boolean>(false);
  const [buttonDisabled, setButtonDisabled] = useState<boolean>(true);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string>('');
  const [newPasswordErrorMessage, setNewPasswordErrorMessage] = useState<string>('');
  const [formErrorMessage, setFormErrorMessage] = useState<string>('');
  const [formSubmitMessage, setFormSubmitMessage] = useState<string>('');

  //new password fields
  const [current_password, setCurrentPassword] = useState<string>('');
  const [new_password, setNewPassword] = useState<string>('');
  const [new_password_confirm, setNewPasswordConfirm] = useState<string>('');

  useEffect(() => {
    const getData = async () => {
      getCurrentAuthUser().then((authUser) => {
        setUsername(authUser.username);
        setIdentityId(authUser.identityId);
      });
    };

    getData();

    return () => {
      // Unmounting
    };
  }, []);

  async function deleteUser() {
    try {
      getCurrentAuthUser()
        .then(async (authUser) => {
          const apiResponse = await graphqlMutate(mutations.deleteUser, { username: authUser.username });
          console.debug(apiResponse);
          await authSignOut();
        })
        .catch((err) => {
          console.debug(err);
        });
    } catch (error) {
      console.debug('Error deleting user', error);
    }
  }

  async function updateUserPW() {
    authChangePassword(current_password, new_password)
      .then((data) => {
        setFormErrorMessage('');
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
        setFormSubmitMessage(t('user-profile.settings.form.pw_changed'));
      })
      .catch((err) => {
        setFormErrorMessage(t('user-profile.settings.form.error'));
        console.debug(err);
      });
  }

  // watch properties for changes and enable generate button if required
  useEffect(() => {
    if (current_password !== '' && new_password !== '' && new_password === new_password_confirm) {
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
    if (new_password !== '' && new_password_confirm !== '') {
      if (new_password !== new_password_confirm) {
        setNewPasswordErrorMessage(t('user-profile.settings.form.pw.error'));
      } else {
        setNewPasswordErrorMessage('');
      }
    } else {
      setNewPasswordErrorMessage('');
    }

    return () => {
      // Unmounting
    };
  }, [current_password, new_password, new_password_confirm]);

  const ValueWithLabel = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );

  return (
    <>
      <PageLayout
        header={t('user-profile.header')}
        description={t('user-profile.description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('user-profile.breadcrumb'), href: '#' },
          { text: t('user-profile.settings.breadcrumb'), href: '/' },
        ]}
      >
        <ColumnLayout columns={2}>
          <Container header={<Header variant="h2">{t('user-profile.header.details')}</Header>}>
            <SpaceBetween size="l">
              <ValueWithLabel label={t('user-profile.settings.name')}>{username}</ValueWithLabel>
            </SpaceBetween>
          </Container>
          <div></div>

          <Container
            header={
              <Header variant="h2" description={t('user-profile.settings.changepw.header')}>
                {t('user-profile.buttons.update-password')}
              </Header>
            }
          >
            <Header variant="h3">{formSubmitMessage}</Header>

            <Form
              errorText={formErrorMessage}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="primary"
                    onClick={() => {
                      updateUserPW();
                    }}
                    disabled={buttonDisabled}
                  >
                    {t('user-profile.buttons.update-password')}
                  </Button>
                </SpaceBetween>
              }
            >
              <Container>
                <SpaceBetween direction="vertical" size="l">
                  <FormField
                    label={t('user-profile.settings.form.label.current_pw')}
                    errorText={passwordErrorMessage}
                  >
                    <Input
                      value={current_password}
                      placeholder={t('user-profile.settings.form.label.current_pw.ph')}
                      type="password"
                      onChange={(change_password) => {
                        setCurrentPassword(change_password.detail.value);
                      }}
                    />
                  </FormField>

                  <FormField
                    label={t('user-profile.settings.form.label.new_pw')}
                    errorText={newPasswordErrorMessage}
                  >
                    <Input
                      value={new_password}
                      placeholder={t('user-profile.settings.form.label.new_pw.ph')}
                      type="password"
                      onChange={(change_password) => {
                        setNewPassword(change_password.detail.value);
                      }}
                    />
                  </FormField>

                  <FormField
                    label={t('user-profile.settings.form.label.new_pw_conf')}
                    errorText={newPasswordErrorMessage}
                  >
                    <Input
                      value={new_password_confirm}
                      placeholder={t('user-profile.settings.form.label.new_pw_conf.ph')}
                      type="password"
                      onChange={(change_password) => {
                        setNewPasswordConfirm(change_password.detail.value);
                      }}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>
            </Form>
          </Container>
          <div></div>

          <Container
            header={
              <Header variant="h2" description={t('user-profile.settings.delete.header')}>
                {t('user-profile.buttons.delete')}
              </Header>
            }
          >
            <Button
              variant="primary"
              onClick={() => {
                setDeleteUserModalVisible(true);
              }}
            >
              {t('user-profile.buttons.delete')}
            </Button>
          </Container>
          <div></div>
        </ColumnLayout>
      </PageLayout>

      <Modal
        onDismiss={() => setDeleteUserModalVisible(false)}
        visible={deleteUserModalVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => {
                  setDeleteUserModalVisible(false);
                }}
              >
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  deleteUser();
                }}
              >
                {t('user-profile.modal.button.delete-confirm')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('user-profile.modal.header-delete-account')}
      >
        {t('user-profile.modal.confirm-delete-account')}: <br></br>
      </Modal>
    </>
  );
};

export { ProfileHome };
