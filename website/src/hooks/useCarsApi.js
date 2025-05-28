import { API, graphqlOperation } from 'aws-amplify';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listCars } from '../graphql/queries';
import { onUpdatedCarsInfo } from '../graphql/subscriptions';
import { useStore } from '../store/store';

import { useRef } from 'react';
import {
  carDeleteAllModels as carDeleteAllModelsOperation,
  carEmergencyStop as carEmergencyStopOperation,
  carRestartService as carRestartServiceOperation,
  carsDelete as carsDeleteOperation,
  carSetTaillightColor as carSetTaillightColorOperation,
  carsUpdateFleet as carsUpdateFleetOperation,
  startFetchFromCar,
} from '../graphql/mutations';
import { availableTaillightColors, carPrintableLabel } from '../graphql/queries';

export const useCarsApi = (userHasAccess = false) => {
  const { t } = useTranslation();
  const [state, dispatch] = useStore();
  const [reload, setReload] = useState(false);
  const [offlineCars, setOfflineCars] = useState(false);

  useEffect(() => {
    if (state.cars.refresh) {
      setReload((prev) => !prev);
    }
  }, [state.cars.refresh]);

  useEffect(() => {
    if (state.cars.offlineCars) {
      setOfflineCars(state.cars.offlineCars);
    }
  }, [state.cars.offlineCars]);

  // adds an error notification for each API error
  const addErrorNotifications = useCallback(
    (apiMethodName, errors, dispatch) => {
      errors.forEach((element, index) => {
        const errorMessage = `${apiMethodName}: ${element.message}`;
        const notificationId = `${apiMethodName}Error${index}`;

        dispatch('ADD_NOTIFICATION', {
          content: errorMessage,
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

  // initial data load
  useEffect(() => {
    try {
      if (userHasAccess) {
        async function getCars(online) {
          const response = await API.graphql(graphqlOperation(listCars, { online: online }));
          dispatch('ADD_CARS', response.data.listCars);
        }
        dispatch('CARS_IS_LOADING', true);
        getCars(true);
        if (offlineCars) {
          getCars(false);
        }
        dispatch('CARS_IS_LOADING', false);
      }
    } catch (error) {
      addErrorNotifications('listCars query', error.errors, dispatch);
    } finally {
      dispatch('CARS_IS_LOADING', false);
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess, dispatch, reload, offlineCars, addErrorNotifications]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    if (userHasAccess) {
      console.debug('Subscribing to onUpdatedCarsInfo');
      const subscription = API.graphql(graphqlOperation(onUpdatedCarsInfo)).subscribe({
        next: (event) => {
          const updatedCars = event.value.data.onUpdatedCarsInfo;
          dispatch('ADD_CARS', updatedCars);
        },
        error: (error) => {
          const errors = error.error.errors;
          addErrorNotifications('onUpdatedCarsInfo subscription', errors, dispatch);
        },
      });

      return () => {
        console.debug('Unsubscribing from onUpdatedCarsInfo');
        if (subscription) subscription.unsubscribe();
      };
    }
  }, [userHasAccess, dispatch, addErrorNotifications]);

  return {
    isLoading: state.cars.isLoading,
  };
};

export const useCarCmdApi = () => {
  const { t } = useTranslation();
  const [, dispatch] = useStore();
  const counterRef = useRef(0);
  const messageDisplayTime = 4000;

  const incrementCounter = useCallback(() => {
    counterRef.current += 1;
    return counterRef.current;
  }, []);

  // adds an error notification for each API error
  const createUpdateNotification = useCallback(
    (label, type, dispatch, notificationId) => {
      dispatch('ADD_NOTIFICATION', {
        content: label,
        type: type,
        dismissible: true,
        dismissLabel: t('devices.notifications.dismiss-message'),
        id: notificationId,
        onDismiss: () => {
          dispatch('DISMISS_NOTIFICATION', notificationId);
        },
      });
      const timeoutId = setTimeout(
        () => dispatch('DISMISS_NOTIFICATION', notificationId),
        messageDisplayTime
      );
      return timeoutId;
    },
    [t]
  );

  // adds an error notification for each API error
  const addNotifications = useCallback(
    (apiMethodName, label, type, dispatch) => {
      const notificationId = `${apiMethodName}_N${incrementCounter()}`;
      createUpdateNotification(label, type, dispatch, notificationId);
      return notificationId;
    },
    [incrementCounter, createUpdateNotification]
  );

  // fetch label from Cars
  function getLabelSync(instanceId, carName) {
    try {
      const startNotifId = addNotifications(
        'getLabelSync',
        t('devices.notifications.label-start') + ' ' + carName,
        'info',
        dispatch
      );
      API.graphql(graphqlOperation(carPrintableLabel, { instanceId: instanceId }))
        .then((response) => {
          const labelURL = response.data.carPrintableLabel.toString();
          dispatch('DISMISS_NOTIFICATION', startNotifId);
          addNotifications(
            'getLabelSync',
            t('devices.notifications.label-ready') + ' ' + carName,
            'success',
            dispatch
          );
          window.open(labelURL);
        })
        .catch((error, startNotifId) => {
          dispatch('DISMISS_NOTIFICATION', startNotifId);
          addNotifications(
            'getLabelSync',
            t('devices.notifications.label-error') + ' ' + carName,
            'error',
            dispatch
          );
          console.error('Error fetching label', error);
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

  // fetch logs from Cars
  function carFetchLogs(selectedCars, selectedEvent, laterThan = null, racerName = null) {
    for (const car of selectedCars) {
      if (car.LoggingCapable === false) {
        addNotifications(
          'carFetchLogs',
          car.ComputerName + t('devices.notifications.fetch-not-possible'),
          'error',
          dispatch
        );
        continue;
      }
      API.graphql(
        graphqlOperation(startFetchFromCar, {
          carInstanceId: car.InstanceId,
          carName: car.ComputerName,
          carFleetId: car.fleetId,
          carFleetName: car.fleetName,
          carIpAddress: car.IpAddress,
          eventId: selectedEvent.eventId,
          eventName: selectedEvent.eventName,
          laterThan: laterThan,
          racerName: racerName,
        })
      )
        .then(() => {
          addNotifications(
            'carFetchLogs',
            t('devices.notifications.fetch-start') + ' ' + car.ComputerName,
            'info',
            dispatch
          );
        })
        .catch((error) => {
          addNotifications(
            'carFetchLogs',
            t('devices.notifications.fetch-error') + ' ' + car.ComputerName,
            'error',
            dispatch
          );
          console.error('Error fetching logs', error);
        });
    }
  }

  // restart service on Cars
  function carRestartService(selectedCars) {
    API.graphql(graphqlOperation(carRestartServiceOperation, { resourceIds: selectedCars }))
      .then(() => {
        addNotifications(
          'carRestartService',
          t('devices.notifications.restart-start'),
          'info',
          dispatch
        );
      })
      .catch((error) => {
        addNotifications(
          'carRestartService',
          t('devices.notifications.restart-error'),
          'error',
          dispatch
        );
        console.error('Error restarting service', error);
      });
  }

  // perform emergency stop on Cars
  function carEmergencyStop(selectedCars) {
    API.graphql(graphqlOperation(carEmergencyStopOperation, { resourceIds: selectedCars }))
      .then(() => {
        addNotifications(
          'carEmergencyStop',
          t('devices.notifications.emergencystop-start'),
          'info',
          dispatch
        );
      })
      .catch((error) => {
        addNotifications(
          'carEmergencyStop',
          t('devices.notifications.emergencystop-error'),
          'error',
          dispatch
        );
        console.error('Error with emergency stop', error);
      });
  }

  // delete Cars (or timers)
  function carsDelete(selectedCars) {
    // Show info notification during processing
    const notificationId = `carsDelete_N${incrementCounter()}`;
    var timeoutId = createUpdateNotification(
      t('devices.notifications.deletedevice-start', { count: selectedCars.length }),
      'info',
      dispatch,
      notificationId
    );

    API.graphql(
      graphqlOperation(carsDeleteOperation, {
        resourceIds: selectedCars,
      })
    )
      .then((response) => {
        console.debug('Delete cars response:', response);
        const deletedCars = JSON.parse(response.data.carsDelete).cars;
        for (const car of deletedCars) {
          dispatch('DELETE_CAR', car);
        }
        // Dismiss the processing notification
        clearTimeout(timeoutId);

        if (deletedCars.length !== selectedCars.length) {
          timeoutId = createUpdateNotification(
            t('devices.notifications.deletedevice-warning', {
              count: selectedCars.length,
              deleted: deletedCars.length,
            }),
            'warning',
            dispatch,
            notificationId
          );
        } else {
          // Show success notification when complete
          timeoutId = createUpdateNotification(
            t('devices.notifications.deletedevice-complete', { count: selectedCars.length }),
            'success',
            dispatch,
            notificationId
          );
        }
      })
      .catch((error) => {
        // Dismiss the processing notification
        clearTimeout(timeoutId);
        timeoutId = createUpdateNotification(
          t('devices.notifications.deletedevice-error'),
          'error',
          dispatch,
          notificationId
        );
        console.error('Error with deleting cars', error);
      });
  }

  // delete all models on Cars
  function carDeleteAllModels(selectedCars, withSystemLogs = false) {
    API.graphql(
      graphqlOperation(carDeleteAllModelsOperation, {
        resourceIds: selectedCars,
        withSystemLogs: withSystemLogs,
      })
    )
      .then(() => {
        addNotifications(
          'carDeleteAllModels',
          t('devices.notifications.deleteall-start'),
          'info',
          dispatch
        );
      })
      .catch((error) => {
        addNotifications(
          'carDeleteAllModels',
          t('devices.notifications.deleteall-error'),
          'error',
          dispatch
        );
        console.error('Error with deleting models', error);
      });
  }

  // update fleet assignment on Cars
  function carsUpdateFleet(selectedCars, fleetName, fleetId) {
    API.graphql(
      graphqlOperation(carsUpdateFleetOperation, {
        resourceIds: selectedCars,
        fleetName: fleetName,
        fleetId: fleetId,
      })
    )
      .then(() => {
        addNotifications(
          'carsUpdateFleet',
          t('devices.notifications.updatefleet-start') + fleetName,
          'info',
          dispatch
        );
      })
      .catch((error) => {
        addNotifications(
          'carsUpdateFleet',
          t('devices.notifications.updatefleet-error'),
          'error',
          dispatch
        );
        console.error('Error with updating fleet', error);
      });
  }

  // update fleet assignment on Cars
  function carsUpdateTaillightColor(selectedCars, taillightColorId) {
    API.graphql(
      graphqlOperation(carSetTaillightColorOperation, {
        resourceIds: selectedCars,
        selectedColor: taillightColorId,
      })
    )
      .then(() => {
        addNotifications(
          'carsUpdateTaillightColor',
          t('devices.notifications.settaillight-start'),
          'info',
          dispatch
        );
      })
      .catch((error) => {
        addNotifications(
          'carsUpdateTaillightColor',
          t('devices.notifications.settaillight-error'),
          'error',
          dispatch
        );
        console.error('Error with updating taillight colors', error);
      });
  }

  // update fleet assignment on Cars
  async function getAvailableTaillightColors() {
    try {
      const response = await API.graphql(graphqlOperation(availableTaillightColors, {}));
      console.debug('Available taillight colors:', response.data.availableTaillightColors);
      return response.data.availableTaillightColors;
    } catch (error) {
      addNotifications(
        'getAvailableTaillightColors',
        t('devices.notifications.taillight-error'),
        'error',
        dispatch
      );
      console.error('Error when getting taillight colors', error);
      throw error;
    }
  }

  return {
    getLabelSync,
    carFetchLogs,
    carRestartService,
    carEmergencyStop,
    carDeleteAllModels,
    carsUpdateFleet,
    carsUpdateTaillightColor,
    carsDelete,
    getAvailableTaillightColors,
  };
};
