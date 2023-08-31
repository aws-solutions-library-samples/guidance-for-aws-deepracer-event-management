import { Box, Button, Modal, RadioGroup, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
export const ChangeRoleModal = ({ onDismiss, visible, onSave }) => {
  const [selectedRole, setSelectedRole] = useState();
  const roles = [
    { value: 'admin', label: 'Administrator' },
    { value: 'operator', label: 'Operator' },
    { value: 'commentator', label: 'Commentator' },
    { value: 'registration', label: 'Registration' },
    { value: 'racer', label: 'Racer' },
  ];

  return (
    <Modal
      header={'Change Role'}
      onDismiss={onDismiss}
      visible={visible}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={onDismiss}>Cancel</Button>
            <Button variant="primary" onClick={() => onSave(selectedRole)}>
              Save
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Box fontWeight="heavy">Choose a role</Box> 
      <RadioGroup
        onChange={({ detail }) => setSelectedRole(detail.value)}
        value={selectedRole}
        items={roles}
      />
    </Modal>
  );
};
