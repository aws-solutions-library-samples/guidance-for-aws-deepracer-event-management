import React, { useEffect, useRef, useState } from "react";
import { Auth } from 'aws-amplify';

import { ContentHeader } from './components/ContentHeader';
import {
  Button,
  FormField,
  Grid,
  SpaceBetween,
} from '@cloudscape-design/components';
import { ModelUploadStatus } from "./components/ModelUploadStatus";

export function Upload() {
  const [username, setUsername] = useState();
  const [identityId, setIdentityId] = useState();
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const getData = async () => {

      Auth.currentAuthenticatedUser()
        .then((user) => setUsername(user.username)
      );
      Auth.currentCredentials()
        .then((creds) => setIdentityId(creds.identityId)
      );
    }

    getData();

    return () => {
      // Unmounting
    }
  }, [])

  const handleFileUpload = (e) => {
    setUploadFiles(e.target.files);
  }

  return (
    <>
      <ContentHeader
        header="Upload models"
        description="Upload models into DREM ready for racing on the track."
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: "Upload models", href: "/upload" }
        ]}
      />

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <FormField
          constraintText='model-name.tar.gz'
          description='Upload physical model for racing on the track'
          label='Upload model'
        >
          <Button
            iconName='upload'
            onClick={() => {
              setUploadFiles([]);
              fileInputRef.current.click();
            }}
          >Choose model file(s)
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept='application/gzip,application/tar'
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
              <ModelUploadStatus file={uploadFiles[i]} username={username} identityId={identityId}/>
            );
          })}
        </SpaceBetween>
        <div></div>
      </Grid>
    </>
  )
}
