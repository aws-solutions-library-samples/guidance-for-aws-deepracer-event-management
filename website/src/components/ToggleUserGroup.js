import React, { useState } from 'react';

import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';

export default ({ disabled, variant }) => {
  const [visible, setVisible] = useState(false);
  const [msgs, setMsgs] = useState([]);

  function modalOpen() {
    setVisible(true);
  }

  function modalClose() {
    setVisible(false);
  }

  return (
    <>
      <Button
        disabled={disabled}
        variant={variant}
        onClick={() => {
          modalOpen();
        }}
      >
        Toggle user
      </Button>

      <Modal
        onDismiss={() => modalClose()}
        visible={visible}
        closeAriaLabel="Close Modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={() => modalClose()}>
                Ok
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Toggle user"
      ></Modal>
    </>
  );
};
