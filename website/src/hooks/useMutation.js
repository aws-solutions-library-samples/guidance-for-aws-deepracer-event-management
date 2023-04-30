import { API, graphqlOperation } from 'aws-amplify';
import { useCallback, useState } from 'react';

import { useTranslation } from 'react-i18next';
import * as mutations from '../graphql/mutations';
import { useNotificationsDispatch } from '../store/appLayoutProvider';

export default function useMutation() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState();
  const [errorMessage, setErrorMessage] = useState('');
  const [addNotification, dismissNotification] = useNotificationsDispatch();

  const generateRequestNotification = useCallback((method, payload) => {
    console.info(payload);
    const lowerCaseMethod = method.toLowerCase();
    let notificationInfo = {
      id: '',
      itemType: '',
      action: '',
      name: '',
    };
    if (lowerCaseMethod.includes('event')) {
      notificationInfo = {
        id: payload.eventName ?? '',
        itemType: t('notifications.item-type-event'),
        name: payload.eventName ?? '',
      };

      let notificationHeader = '';
      const itemType = notificationInfo.itemType;
      const itemName = notificationInfo.name;
      if (lowerCaseMethod.includes('add')) {
        notificationInfo['action'] = 'add';
        notificationHeader = t('notifications.creating-item', { itemType, itemName });
      } else if (lowerCaseMethod.includes('update')) {
        notificationInfo['action'] = 'update';
        notificationHeader = t('notifications.updating-item', { itemType, itemName });
      } else if (lowerCaseMethod.includes('delete')) {
        notificationInfo['action'] = 'delete';
        notificationHeader = t('notifications.deleting-item', { itemType, itemName });
      }

      addNotification({
        header: notificationHeader,
        type: 'info',
        loading: true,
        dismissible: true,
        dismissLabel: 'Dismiss message',
        id: notificationInfo.id,
        onDismiss: () => {
          dismissNotification(notificationInfo.id);
        },
      });
    }

    return notificationInfo;
  }, []);

  const generateResponseNotification = useCallback((notificationInfo, status, errorMessage) => {
    let notificationHeader = '';
    const itemType = notificationInfo.itemType;
    const itemName = notificationInfo.name;
    if (notificationInfo.action === 'add' && status === 'success')
      notificationHeader = t('notifications.create-item-success', { itemType, itemName });
    else if (notificationInfo.action === 'add' && status === 'error')
      notificationHeader = t('notifications.create-item-error', {
        itemType,
        itemName,
        errorMessage,
      });
    else if (notificationInfo.action === 'update' && status === 'success')
      notificationHeader = t('notifications.update-item-success', { itemType, itemName });
    else if (notificationInfo.action === 'update' && status === 'error')
      notificationHeader = t('notifications.update-item-error', {
        itemType,
        itemName,
        errorMessage,
      });
    else if (notificationInfo.action === 'delete' && status === 'success')
      notificationHeader = t('notifications.delete-item-success', { itemType, itemName });
    else if (notificationInfo.action === 'delete' && status === 'error')
      notificationHeader = t('notifications.delete-item-error', {
        itemType,
        itemName,
        errorMessage,
      });

    addNotification({
      header: notificationHeader,
      type: status,
      dismissible: true,
      dismissLabel: 'Dismiss message',
      id: notificationInfo.id,
      onDismiss: () => {
        dismissNotification(notificationInfo.id);
      },
    });
  }, []);

  const send = useCallback(
    async (method, payload) => {
      setIsLoading(true);
      setData();
      const notificationInfo = generateRequestNotification(method, payload);

      API.graphql(graphqlOperation(mutations[method], payload))
        .then((response) => {
          setData({ ...response.data[method] });
          generateResponseNotification(notificationInfo, 'success');
          setIsLoading(false);
          setErrorMessage('');
        })
        .catch((error) => {
          generateResponseNotification(notificationInfo, 'error', error.errors[0].message);
          console.warn(error.errors[0].message);
          setIsLoading(false);
          setErrorMessage(error.errors[0].message);
          setData();
        });
    },
    [generateResponseNotification, generateRequestNotification]
  );

  return [send, isLoading, errorMessage, data];
}
