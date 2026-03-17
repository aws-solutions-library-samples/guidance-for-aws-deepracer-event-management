import React, { useState } from 'react';
import { Box, Button, ButtonProps, Modal, SpaceBetween } from '@cloudscape-design/components';

/**
 * Props interface for ToggleUserGroup component
 */
interface ToggleUserGroupProps {
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button variant style */
  variant?: ButtonProps.Variant;
}

/**
 * ToggleUserGroup component that displays a button to toggle user group membership
 * @param props - Component props
 * @returns Rendered toggle button with modal
 */
const ToggleUserGroup = ({ disabled, variant }: ToggleUserGroupProps): JSX.Element => {
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

export default ToggleUserGroup;
