import { Box, Button, Modal, RadioGroup, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const ChangeRoleModal = ({ onDismiss, visible, onSave }) => {
  const { t } = useTranslation();
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
      header={t('users-admin.change-role-modal-title')}
      onDismiss={onDismiss}
      visible={visible}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={onDismiss}>{t('button.cancel')}</Button>
            <Button variant="primary" onClick={() => onSave(selectedRole)}>
              {t('button.save')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Box fontWeight="heavy">{t('users-admin.change-role-modal-sub')}</Box> 
      <RadioGroup
        onChange={({ detail }) => setSelectedRole(detail.value)}
        value={selectedRole}
        items={roles}
      />
    </Modal>
  );
};
