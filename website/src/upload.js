import { Auth } from 'aws-amplify';
import React, { useEffect, useRef, useState } from 'react';

import { Button, FormField, Grid, SpaceBetween } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { ContentHeader } from './components/ContentHeader';
import { ModelUploadStatus } from './components/ModelUploadStatus';

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
      <ContentHeader
        header={t('upload.header')}
        description={t('upload.header-description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('home.breadcrumb'), href: '/upload' },
        ]}
      />

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
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
        <div></div>
      </Grid>

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
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
        <div></div>
      </Grid>
    </>
  );
};

export { Upload };
