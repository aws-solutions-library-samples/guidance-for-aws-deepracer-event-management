import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Props interface for DeleteModal component
 */
interface DeleteModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback to change modal visibility */
  onVisibleChange: (visible: boolean) => void;
  /** Callback function when delete is confirmed */
  onDelete: () => void;
  /** Child content to display in the modal */
  children: ReactNode;
  /** Header text for the modal */
  header: string;
}

/**
 * DeleteModal component that displays a confirmation modal for delete operations
 * @param props - Component props
 * @returns Rendered delete confirmation modal
 */
export const DeleteModal = ({ 
  visible, 
  onVisibleChange, 
  onDelete, 
  children, 
  header 
}: DeleteModalProps): JSX.Element => {
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

/**
 * Props interface for ItemList component
 */
interface ItemListProps {
  /** Array of items to display in the list */
  items: string[];
}

/**
 * ItemList component that renders a list of items
 * @param props - Component props
 * @returns Rendered unordered list
 */
export const ItemList = ({ items }: ItemListProps): JSX.Element => {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
};
