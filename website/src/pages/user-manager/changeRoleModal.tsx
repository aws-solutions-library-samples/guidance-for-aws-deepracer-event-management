import { Box, Button, Modal, RadioGroup, RadioGroupProps, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Role types available in the system
 */
type RoleType = 'admin' | 'operator' | 'commentator' | 'registration' | 'racer';

/**
 * Props interface for ChangeRoleModal component
 */
interface ChangeRoleModalProps {
  /** Callback when modal is dismissed */
  onDismiss: () => void;
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when role is saved with selected role value */
  onSave: (role: RoleType | undefined) => void;
}

/**
 * ChangeRoleModal component that allows changing a user's role
 * @param props - Component props
 * @returns Rendered modal with role selection
 */
export const ChangeRoleModal = ({ onDismiss, visible, onSave }: ChangeRoleModalProps): JSX.Element => {
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<RoleType | undefined>();
  
  const roles: RadioGroupProps.RadioButtonDefinition[] = [
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
        onChange={({ detail }) => setSelectedRole(detail.value as RoleType)}
        value={selectedRole || null}
        items={roles}
      />
    </Modal>
  );
};
