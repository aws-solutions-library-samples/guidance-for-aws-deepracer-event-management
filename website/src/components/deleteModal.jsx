import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const DeleteModal = ({ visible, onVisibleChange, onDelete, children, header }) => {
  const { t } = useTranslation();

  return (
    <Modal
      onDismiss={() => onVisibleChange(false)}
      visible={visible}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => onVisibleChange(false)}>
              {t('button.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onDelete();
                onVisibleChange(false);
              }}
            >
              {t('button.delete')}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header={header}
    >
      {children}
    </Modal>
  );
};

export const ItemList = ({ items }) => {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
};
