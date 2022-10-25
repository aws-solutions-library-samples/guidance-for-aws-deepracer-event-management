import React, { useEffect, useState } from "react";
import { Storage } from 'aws-amplify';
import {
  Container,
  ProgressBar,
  StatusIndicator
} from "@cloudscape-design/components";

export function FileUploadStatus(props) {
  const file = props.file;
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState('Pending');

  const statusIcon = status.toLowerCase().replace(/\s/g, '-');
  const s3path = props.username + "/models/" + file.name.replace(/\s/g, '_');

  // TODO - switch to flashbar with progres bar
  // https://cloudscape.design/components/flashbar/?tabId=playground&example=with-a-progress-bar

  useEffect(() => {
    const saveModel = async() => {
      Storage.put((s3path), file, {
        level: 'private',
        contentType: file.type,
        tagging: 'lifecycle=true',
        progressCallback(progress) {
          setStatus('In progress');
          setPercent(Math.round(progress.loaded/progress.total*100))
        }
      }).then (result => {
        console.log(result)
        setStatus('Success');
      }).catch (err => {
        console.log(err)
        setStatus('Error');
      });

    }

    saveModel();

    return() => {
      // Unmounting
    }
  },[])

  return (
    <React.Fragment key={file.name}>
      <Container textAlign='center'>
        <ProgressBar
          value={percent}
        />
        <StatusIndicator type={statusIcon}>
          {status}
        </StatusIndicator>
        <div>
          {file.name}
        </div>
        <div>
          {(file.size/1024/1024).toFixed(2)} Mb
        </div>
      </Container>
    </React.Fragment>
  );
}
