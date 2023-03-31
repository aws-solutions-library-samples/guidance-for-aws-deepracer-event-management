import { API, Auth } from 'aws-amplify';

import ColumnLayout from '@cloudscape-design/components/column-layout';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageLayout } from '../../components/pageLayout';

import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';

import * as mutations from '../../graphql/mutations';

import {
  Box,
  Button, Form,
  FormField, Input, Modal,
  SpaceBetween
} from '@cloudscape-design/components';

    const ProfileHome = (props) => {
    const { t } = useTranslation();

    const [username, setUsername] = useState();
    const [identityId, setIdentityId] = useState();
    const [deleteUserModalVisible, setDeleteUserModalVisible] = useState(false);
    const [buttonDisabled, setButtonDisabled] = useState(true);
    const [passwordErrorMessage, setPasswordErrorMessage] = useState('');
    const [newPasswordErrorMessage, setNewPasswordErrorMessage] = useState('');
    const [formErrorMessage, setFormErrorMessage] = useState('');
    const [formSubmitMessage, setFormSubmitMessage] = useState('');

    //new password fields
    const [current_password, setCurrentPassword] = useState('');
    const [new_password, setNewPassword] = useState('');
    const [new_password_confirm, setNewPasswordConfirm] = useState('');

    useEffect(() => {
        const getData = async () => {
            Auth.currentAuthenticatedUser().then((user) => setUsername(user.username));
            Auth.currentCredentials().then((creds) => setIdentityId(creds.identityId));
        };

        getData();

        return () => {
            // Unmounting
        };
    }, []);

    async function deleteUser() {
      try {
        Auth.currentAuthenticatedUser()
          .then(async (user) => {
            const username = user.username;        
            const apiResponse = await API.graphql({
              query: mutations.deleteUser,
              variables: {
                username: username,
              },
            });
            console.log(apiResponse)
            Auth.signOut()
          })
          .catch((err) => {
            console.log(err);
          });
      } catch (error) {
        console.log('Error deleting user', error);
      }
    };

    async function updateUserPW() {

      Auth.currentAuthenticatedUser()
        .then((user) => {
          return Auth.changePassword(user, current_password, new_password);
        })
        .then((data) => {
            setFormErrorMessage("");
            setCurrentPassword("");
            setNewPassword("");
            setNewPasswordConfirm("");
            setFormSubmitMessage(t('user-profile.settings.form.pw_changed'))

        })
        .catch((err) => {
            setFormErrorMessage(t('user-profile.settings.form.error'))
            console.log(err)
        });

    };

    // watch properties for changes and enable generate button if required
    useEffect(() => {
      if (current_password !== '' && new_password !== '' && new_password === new_password_confirm) {
        setButtonDisabled(false);
      } else {
        setButtonDisabled(true);
      }
      if(new_password !== '' && new_password_confirm !== '') {
        if(new_password !== new_password_confirm) {
            setNewPasswordErrorMessage(t('user-profile.settings.form.pw.error'))
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

    const ValueWithLabel = ({ label, children }) => (
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
                    { text: t('user-profile.breadcrumb') },
                    { text: t('user-profile.settings.breadcrumb'), href: '/' },
                ]}
            >
                <ColumnLayout columns={2}>
                    <Container
                        header={
                            <Header variant="h2" description={t('user-profile.settings.header')}>
                                {t('user-profile.header.details')}
                            </Header>
                        }
                    >
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


                        <Form errorText={formErrorMessage}
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
                          <Container textAlign="center">
                            <SpaceBetween direction="vertical" size="l">

                              <FormField label={t('user-profile.settings.form.label.current_pw')} errorText={passwordErrorMessage}>
                                <Input
                                  value={current_password}
                                  placeholder={t('user-profile.settings.form.label.current_pw.ph')}
                                  type="password"
                                  onChange={(change_password) => {
                                    setCurrentPassword(change_password.detail.value);
                                  }}
                                />
                              </FormField>

                              <FormField label={t('user-profile.settings.form.label.new_pw')} errorText={newPasswordErrorMessage}>
                                <Input
                                  value={new_password}
                                  placeholder={t('user-profile.settings.form.label.new_pw.ph')}
                                  type="password"
                                  onChange={(change_password) => {
                                    setNewPassword(change_password.detail.value);
                                  }}
                                />
                              </FormField>

                              <FormField label={t('user-profile.settings.form.label.new_pw_conf')} errorText={newPasswordErrorMessage}>
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
