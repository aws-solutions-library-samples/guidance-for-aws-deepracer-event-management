import { Auth } from 'aws-amplify';
import React, { useEffect, useRef, useState } from 'react';

import { Button, Container, FormField, SpaceBetween } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { ModelUploadStatus } from './components/modelUploadStatus';
import { PageLayout } from './components/pageLayout';

const Upload = () => {
  const { t } = useTranslation();

  const [username, setUsername] = useState();
  const [identityId, setIdentityId] = useState();
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileInputRef = useRef(null);

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

  const handleFileUpload = (e) => {
    setUploadFiles(e.target.files);
  };

  return (
    <>
      <PageLayout
        header={t('upload.header')}
        description={t('upload.header-description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('upload.breadcrumb'), href: '/upload' },
        ]}
      >
        <Container>
          <FormField
            constraintText={t('upload.constraint-text')}
            description={t('upload.constraint-description')}
            label={t('upload.label')}
          >
            <Button
              iconName="upload"
              onClick={() => {
                setUploadFiles([]);
                fileInputRef.current.click();
              }}
            >
              {t('upload.chose-file')}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="application/gzip,application/tar"
                multiple
                hidden
              />
            </Button>
          </FormField>

          <SpaceBetween direction="vertical" size="s">
            {Object.keys(uploadFiles).map((i) => {
              return (
                <ModelUploadStatus
                  file={uploadFiles[i]}
                  username={username}
                  identityId={identityId}
                  key={uploadFiles[i]}
                />
              );
            })}
          </SpaceBetween>
        </Container>
      </PageLayout>
    </>
  );
};

export { Upload };
