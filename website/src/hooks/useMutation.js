import { API, graphqlOperation } from 'aws-amplify';
import { useCallback, useState } from 'react';

import { useTranslation } from 'react-i18next';
import * as mutations from '../graphql/mutations';
import { useStore } from '../store/store';

export default function useMutation() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState();
  const [errorMessage, setErrorMessage] = useState('');
  const [, dispatch] = useStore();

  const generateRequestNotification = useCallback(
    (method, payload) => {
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
      } else if (lowerCaseMethod.includes('user')) {
        notificationInfo = {
          id: payload.username ?? '',
          itemType: t('notifications.item-type-user'),
          name: payload.username ?? '',
        };
      } else if (lowerCaseMethod.includes('race')) {
        notificationInfo = {
          id: payload.raceId ?? '',
          itemType: t('notifications.item-type-race'),
          name: payload.raceId ?? '',
        };
      } else if (lowerCaseMethod.includes('model')) {
        console.info('NOTIFICATION', payload);
        notificationInfo = {
          id: payload.modelId ?? '',
          itemType: t('notifications.item-type-model'),
          name: payload.modelname ?? '',
        };
      } else if (lowerCaseMethod.includes('carlogsasset')) {
        console.info('NOTIFICATION', payload);
        notificationInfo = {
          id: payload.assetId ?? '',
          itemType: t('notifications.item-type-asset'),
          name: payload.filename ?? '',
        };
      } else {
        notificationInfo = {
          id: 'common',
          itemType: 'unknown',
          name: '',
        };
      }

      let notificationHeader;
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

      if (notificationHeader != null && notificationInfo.itemType !== 'unknown') {
        console.debug(
          'Add request - notification',
          notificationInfo,
          notificationInfo.itemType !== 'unknown'
        );
        dispatch('ADD_NOTIFICATION', {
          content: notificationHeader,
          type: 'info',
          loading: true,
          dismissible: true,
          dismissLabel: 'Dismiss message',
          id: notificationInfo.id,
          onDismiss: () => {
            dispatch('DISMISS_NOTIFICATION', notificationInfo.id);
          },
        });
      }

      return notificationInfo;
    },
    [dispatch, t]
  );

  const generateResponseNotification = useCallback(
    (notificationInfo, status, errorMessage) => {
      let notificationHeader;
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

      if (notificationHeader != null && notificationInfo.itemType !== 'unknown') {
        console.debug('Add response - notification');
        dispatch('ADD_NOTIFICATION', {
          content: notificationHeader,
          type: status,
          dismissible: true,
          dismissLabel: 'Dismiss message',
          id: notificationInfo.id,
          onDismiss: () => {
            dispatch('DISMISS_NOTIFICATION', notificationInfo.id);
          },
        });
      }
    },
    [dispatch, t]
  );

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
