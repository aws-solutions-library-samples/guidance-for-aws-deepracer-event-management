import { API, graphqlOperation } from 'aws-amplify';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listCars } from '../graphql/queries';
import { onUpdatedCarsStatus } from '../graphql/subscriptions';
import { useStore } from '../store/store';

import { useRef } from 'react';
import {
  carDeleteAllModels as carDeleteAllModelsOperation,
  carEmergencyStop as carEmergencyStopOperation,
  carRestartService as carRestartServiceOperation,
  carSetTaillightColor as carSetTaillightColorOperation,
  carsUpdateFleet as carsUpdateFleetOperation,
  startFetchFromCar,
} from '../graphql/mutations';
import { availableTaillightColors, carPrintableLabel } from '../graphql/queries';

export const useCarsApi = (userHasAccess = false) => {
  const { t } = useTranslation();
  const [state, dispatch] = useStore();
  const [reload, setReload] = useState(false);

  useEffect(() => {
    if (state.cars.refresh) {
      setReload((prev) => !prev);
    }
  }, [state.cars.refresh]);

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
        getCars(false);
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
  }, [userHasAccess, dispatch, reload, addErrorNotifications]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(onUpdatedCarsStatus)).subscribe({
      next: (event) => {
        const updatedCars = event.value.data.onUpdatedCarsStatus;
        dispatch('ADD_CARS', updatedCars);
      },
      error: (error) => {
        const errors = error.error.errors;
        addErrorNotifications('onUpdatedCarsStatus subscription', errors, dispatch);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch, addErrorNotifications]);

  return {};
};

export const useCarCmdApi = () => {
  const { t } = useTranslation();
  const [, dispatch] = useStore();
  const counterRef = useRef(0);

  const incrementCounter = useCallback(() => {
    counterRef.current += 1;
    return counterRef.current;
  }, []);

  // adds an error notification for each API error
  const addNotifications = useCallback(
    (apiMethodName, label, type, dispatch) => {
      const notificationId = `${apiMethodName}_N${incrementCounter()}`;
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
      return notificationId;
    },
    [t, incrementCounter]
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
  function carFetchLogs(selectedCars, selectedEvent) {
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
          laterThan: null,
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

  // delete all models on Cars
  function carDeleteAllModels(selectedCars) {
    API.graphql(graphqlOperation(carDeleteAllModelsOperation, { resourceIds: selectedCars }))
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
    getAvailableTaillightColors,
  };
};
