import React, { useState } from 'react';
import { Box, Button, ButtonProps, Modal, SpaceBetween } from '@cloudscape-design/components';

/**
 * Props interface for CreateGroupModal component
 */
interface CreateGroupModalProps {
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button variant style */
  variant?: ButtonProps.Variant;
}

/**
 * CreateGroupModal component that displays a modal for creating a group
 * @param props - Component props
 * @returns Rendered button and modal
 */
const CreateGroupModal = ({ disabled, variant }: CreateGroupModalProps): JSX.Element => {
  const [visible, setVisible] = useState<boolean>(false);

  const modalOpen = (): void => {
    setVisible(true);
  };

  const modalClose = (): void => {
    setVisible(false);
  };

  return (
    <>
      <Button
        disabled={disabled}
        variant={variant}
        onClick={() => {
          modalOpen();
        }}
      >
        Create group
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
        header="Create group"
      ></Modal>
    </>
  );
};

export default CreateGroupModal;
