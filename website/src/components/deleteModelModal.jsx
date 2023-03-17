import { Storage } from 'aws-amplify';
import React, { useState } from 'react';

import { Box, Button, Flashbar, Modal, SpaceBetween } from '@cloudscape-design/components';

/* eslint import/no-anonymous-default-export: [2, {"allowArrowFunction": true}] */
export default ({ disabled, selectedItems, removeItem, variant }) => {
  const [visible, setVisible] = useState(false);
  const [msgs, setMsgs] = useState([]);

  function modalOpen(selectedModels) {
    setVisible(true);

    for (const i in selectedModels) {
      const model = selectedModels[i];
      Storage.remove(model.key, { level: 'private' });

      setMsgs((msgs) => [
        ...msgs,
        {
          header: model.modelName,
          type: 'success',
          content: 'The model has been deleted.',
          dismissible: true,
          dismissLabel: 'Dismiss message',
          onDismiss: () => setMsgs((msgs) => msgs.filter((msgs) => msgs.id !== model.key)),
          id: model.key,
        },
      ]);
      removeItem(model.key);
    }
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
          modalOpen(selectedItems);
        }}
      >
        Delete models
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
        header="Delete models"
      >
        Deleting models
        <Flashbar items={msgs} />
      </Modal>
    </>
  );
};
