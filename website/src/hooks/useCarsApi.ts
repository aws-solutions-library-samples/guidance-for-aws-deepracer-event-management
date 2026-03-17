// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Uses typed GraphQL helpers from graphqlHelpers.ts for proper TypeScript coverage.
// All API.graphql() calls are replaced with graphqlQuery, graphqlMutate, or graphqlSubscribe.
//
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { graphqlQuery, graphqlSubscribe } from '../graphql/graphqlHelpers';
import {
    carDeleteAllModels as carDeleteAllModelsOperation,
    carEmergencyStop as carEmergencyStopOperation,
    carRestartService as carRestartServiceOperation,
    carsDelete as carsDeleteOperation,
    carSetTaillightColor as carSetTaillightColorOperation,
    carsUpdateFleet as carsUpdateFleetOperation,
    startFetchFromCar,
} from '../graphql/mutations';
import { availableTaillightColors, carPrintableLabel, listCars } from '../graphql/queries';
import { onUpdatedCarsInfo } from '../graphql/subscriptions';
import { useStore } from '../store/store';

interface ApiError {
    message: string;
}

interface SelectedEvent {
    eventId: string;
    eventName: string;
    [key: string]: any;
}

export const useCarsApi = (userHasAccess = false) => {
    const { t } = useTranslation();
    const [state, dispatch] = useStore();
    const [reload, setReload] = useState(false);
    const [offlineCars, setOfflineCars] = useState(false);

    useEffect(() => {
        if (state.cars?.refresh) {
            setReload((prev: boolean) => !prev);
        }
    }, [state.cars?.refresh]);

    useEffect(() => {
        if (state.cars?.offlineCars) {
            setOfflineCars(state.cars.offlineCars);
        }
    }, [state.cars?.offlineCars]);

    // adds an error notification for each API error
    const addErrorNotifications = useCallback(
        (apiMethodName: string, errors: ApiError[], dispatchFn: any) => {
            errors.forEach((element: ApiError, index: number) => {
                const errorMessage = `${apiMethodName}: ${element.message}`;
                const notificationId = `${apiMethodName}Error${index}`;

                dispatchFn('ADD_NOTIFICATION', {
                    content: errorMessage,
                    type: 'error',
                    dismissible: true,
                    dismissLabel: t('devices.notifications.dismiss-message'),
                    id: notificationId,
                    onDismiss: () => {
                        dispatchFn('DISMISS_NOTIFICATION', notificationId);
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
                async function getCars(online: boolean) {
                    const response = await graphqlQuery<{ listCars: any[] }>(listCars, {
                        online: online,
                    });
                    dispatch('ADD_CARS', response.listCars);
                }
                dispatch('CARS_IS_LOADING', true);
                getCars(true);
                if (offlineCars) {
                    getCars(false);
                }
                dispatch('CARS_IS_LOADING', false);
            }
        } catch (error: any) {
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
            const subscription = graphqlSubscribe<{
                onUpdatedCarsInfo: any[];
            }>(onUpdatedCarsInfo).subscribe({
                next: (event) => {
                    const updatedCars = event.value.data.onUpdatedCarsInfo;
                    dispatch('ADD_CARS', updatedCars);
                },
                error: (error: any) => {
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
        isLoading: state.cars?.isLoading,
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

    // creates or updates a notification
    const createUpdateNotification = useCallback(
        (label: string, type: string, dispatchFn: any, notificationId: string) => {
            dispatchFn('ADD_NOTIFICATION', {
                content: label,
                type: type,
                dismissible: true,
                dismissLabel: t('devices.notifications.dismiss-message'),
                id: notificationId,
                onDismiss: () => {
                    dispatchFn('DISMISS_NOTIFICATION', notificationId);
                },
            });
            const timeoutId = setTimeout(
                () => dispatchFn('DISMISS_NOTIFICATION', notificationId),
                messageDisplayTime
            );
            return timeoutId;
        },
        [t]
    );

    // adds a notification and returns its ID
    const addNotifications = useCallback(
        (apiMethodName: string, label: string, type: string, dispatchFn: any) => {
            const notificationId = `${apiMethodName}_N${incrementCounter()}`;
            createUpdateNotification(label, type, dispatchFn, notificationId);
            return notificationId;
        },
        [incrementCounter, createUpdateNotification]
    );

    // fetch label from Cars
    async function getLabelSync(instanceId: string, carName: string) {
        const startNotifId = addNotifications(
            'getLabelSync',
            t('devices.notifications.label-start') + ' ' + carName,
            'info',
            dispatch
        );
        try {
            const response = await graphqlQuery<{ carPrintableLabel: string }>(carPrintableLabel, {
                instanceId: instanceId,
            });
            const labelURL = response.carPrintableLabel.toString();
            dispatch('DISMISS_NOTIFICATION', startNotifId);
            addNotifications(
                'getLabelSync',
                t('devices.notifications.label-ready') + ' ' + carName,
                'success',
                dispatch
            );
            window.open(labelURL);
        } catch (error) {
            dispatch('DISMISS_NOTIFICATION', startNotifId);
            addNotifications(
                'getLabelSync',
                t('devices.notifications.label-error') + ' ' + carName,
                'error',
                dispatch
            );
            console.error('Error fetching label', error);
        }
    }

    // fetch logs from Cars
    async function carFetchLogs(
        selectedCars: any[],
        selectedEvent: SelectedEvent,
        laterThan: string | null = null,
        racerName: string | null = null,
        raceData: any = null
    ) {
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
            const operationInput: Record<string, any> = {
                carInstanceId: car.InstanceId,
                carName: car.ComputerName,
                carFleetId: car.fleetId,
                carFleetName: car.fleetName,
                carIpAddress: car.IpAddress,
                eventId: selectedEvent.eventId,
                eventName: selectedEvent.eventName,
                laterThan: laterThan,
                racerName: racerName,
                raceData: raceData !== null ? JSON.stringify(raceData) : null,
            };

            try {
                await graphqlQuery(startFetchFromCar, operationInput);
                addNotifications(
                    'carFetchLogs',
                    t('devices.notifications.fetch-start') + ' ' + car.ComputerName,
                    'info',
                    dispatch
                );
            } catch (error) {
                addNotifications(
                    'carFetchLogs',
                    t('devices.notifications.fetch-error') + ' ' + car.ComputerName,
                    'error',
                    dispatch
                );
                console.error('Error fetching logs', error);
            }
        }
    }

    // restart service on Cars
    async function carRestartService(selectedCars: string[]) {
        try {
            await graphqlQuery(carRestartServiceOperation, { resourceIds: selectedCars });
            addNotifications(
                'carRestartService',
                t('devices.notifications.restart-start'),
                'info',
                dispatch
            );
        } catch (error) {
            addNotifications(
                'carRestartService',
                t('devices.notifications.restart-error'),
                'error',
                dispatch
            );
            console.error('Error restarting service', error);
        }
    }

    // perform emergency stop on Cars
    async function carEmergencyStop(selectedCars: string[]) {
        try {
            await graphqlQuery(carEmergencyStopOperation, { resourceIds: selectedCars });
            addNotifications(
                'carEmergencyStop',
                t('devices.notifications.emergencystop-start'),
                'info',
                dispatch
            );
        } catch (error) {
            addNotifications(
                'carEmergencyStop',
                t('devices.notifications.emergencystop-error'),
                'error',
                dispatch
            );
            console.error('Error with emergency stop', error);
        }
    }

    // delete Cars (or timers)
    async function carsDelete(selectedCars: string[]) {
        const notificationId = `carsDelete_N${incrementCounter()}`;
        let timeoutId = createUpdateNotification(
            t('devices.notifications.deletedevice-start', { count: selectedCars.length }),
            'info',
            dispatch,
            notificationId
        );

        try {
            const response = await graphqlQuery<{ carsDelete: string }>(carsDeleteOperation, {
                resourceIds: selectedCars,
            });
            const deletedCars = JSON.parse(response.carsDelete).cars;
            for (const car of deletedCars) {
                dispatch('DELETE_CAR', car);
            }
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
                timeoutId = createUpdateNotification(
                    t('devices.notifications.deletedevice-complete', {
                        count: selectedCars.length,
                    }),
                    'success',
                    dispatch,
                    notificationId
                );
            }
        } catch (error) {
            clearTimeout(timeoutId);
            timeoutId = createUpdateNotification(
                t('devices.notifications.deletedevice-error'),
                'error',
                dispatch,
                notificationId
            );
            console.error('Error with deleting cars', error);
        }
    }

    // delete all models on Cars
    async function carDeleteAllModels(selectedCars: string[], withSystemLogs = false) {
        try {
            await graphqlQuery(carDeleteAllModelsOperation, {
                resourceIds: selectedCars,
                withSystemLogs: withSystemLogs,
            });
            addNotifications(
                'carDeleteAllModels',
                t('devices.notifications.deleteall-start'),
                'info',
                dispatch
            );
        } catch (error) {
            addNotifications(
                'carDeleteAllModels',
                t('devices.notifications.deleteall-error'),
                'error',
                dispatch
            );
            console.error('Error with deleting models', error);
        }
    }

    // update fleet assignment on Cars
    async function carsUpdateFleet(selectedCars: string[], fleetName: string, fleetId: string) {
        try {
            await graphqlQuery(carsUpdateFleetOperation, {
                resourceIds: selectedCars,
                fleetName: fleetName,
                fleetId: fleetId,
            });
            addNotifications(
                'carsUpdateFleet',
                t('devices.notifications.updatefleet-start') + fleetName,
                'info',
                dispatch
            );
        } catch (error) {
            addNotifications(
                'carsUpdateFleet',
                t('devices.notifications.updatefleet-error'),
                'error',
                dispatch
            );
            console.error('Error with updating fleet', error);
        }
    }

    // update taillight color on Cars
    async function carsUpdateTaillightColor(selectedCars: string[], taillightColorId: string) {
        try {
            await graphqlQuery(carSetTaillightColorOperation, {
                resourceIds: selectedCars,
                selectedColor: taillightColorId,
            });
            addNotifications(
                'carsUpdateTaillightColor',
                t('devices.notifications.settaillight-start'),
                'info',
                dispatch
            );
        } catch (error) {
            addNotifications(
                'carsUpdateTaillightColor',
                t('devices.notifications.settaillight-error'),
                'error',
                dispatch
            );
            console.error('Error with updating taillight colors', error);
        }
    }

    // get available taillight colors
    async function getAvailableTaillightColors() {
        try {
            const response = await graphqlQuery<{ availableTaillightColors: any }>(
                availableTaillightColors,
                {}
            );
            console.debug('Available taillight colors:', response.availableTaillightColors);
            return response.availableTaillightColors;
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
