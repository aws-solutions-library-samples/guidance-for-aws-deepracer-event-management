import { API, graphqlOperation } from 'aws-amplify';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { carPrintableLabel } from '../graphql/queries';
import { useStore } from '../store/store';

export const useCarCmdApi = () => {
  const { t } = useTranslation();
  const [, dispatch] = useStore();
  const counterRef = useRef(0);

  const incrementCounter = useCallback(() => {
    counterRef.current += 1;
    return counterRef.current;
  }, []);

  // adds an error notification for each API error
  const addErrorNotifications = useCallback(
    (apiMethodName, errors, dispatch) => {
      errors.forEach((element, index) => {
        const errorMessage = `${apiMethodName}: ${element.message}`;
        const notificationId = `${apiMethodName}Error${index}`;

        dispatch('ADD_NOTIFICATION', {
          header: errorMessage,
          type: 'error',
          dismissible: true,
          dismissLabel: t('devices.notifications.dismiss-message'),
          id: notificationId,
          onDismiss: () => {
            dispatch('DISMISS_NOTIFICATION', notificationId);
          },
        });
      });
    },
    [t]
  );

  // adds an error notification for each API error
  const addNotifications = useCallback(
    (apiMethodName, label, type, dispatch) => {
      const notificationId = `${apiMethodName}Notif${incrementCounter()}`;
      dispatch('ADD_NOTIFICATION', {
        header: label,
        type: type,
        dismissible: true,
        dismissLabel: t('devices.notifications.dismiss-message'),
        id: notificationId,
        onDismiss: () => {
          dispatch('DISMISS_NOTIFICATION', notificationId);
        },
      });
    },
    [t]
  );

  function getLabelSync(instanceId, carName) {
    try {
      API.graphql(graphqlOperation(carPrintableLabel, { instanceId: instanceId }))
        .then((response) => {
          const labelURL = response.data.carPrintableLabel.toString();
          addNotifications(
            'getLabelSync',
            t('devices.notifications.label-ready') + ' ' + carName,
            'info',
            dispatch
          );
          window.open(labelURL);
        })
        .catch((error) => {
          addNotifications(
            'getLabelSync',
            t('devices.notifications.error-label') + ' ' + carName,
            'error',
            dispatch
          );
        });
    } catch (error) {
      addNotifications(
        'getLabelSync',
        t('devices.notifications.error-label') + ' ' + carName,
        'error',
        dispatch
      );
    }
  }

  return { getLabelSync };
};
