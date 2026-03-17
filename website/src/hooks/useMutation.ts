import { useCallback, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { graphqlQuery } from '../graphql/graphqlHelpers';
import * as mutations from '../graphql/mutations';
import { useStore } from '../store/store';

interface NotificationInfo {
    id: string;
    itemType: string;
    action: string;
    name: string;
}

type MutationMethod = keyof typeof mutations;
type MutationStatus = 'success' | 'error';

export default function useMutation(): [
    (method: MutationMethod, payload: any) => Promise<void>,
    boolean,
    string,
    any,
] {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [data, setData] = useState<any>();
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [, dispatch] = useStore();

    const generateRequestNotification = useCallback(
        (method: MutationMethod, payload: any): NotificationInfo => {
            const lowerCaseMethod = method.toLowerCase();
            let notificationInfo: NotificationInfo = {
                id: '',
                itemType: '',
                action: '',
                name: '',
            };
            if (lowerCaseMethod.includes('event')) {
                notificationInfo = {
                    id: payload.eventName ?? '',
                    itemType: t('notifications.item-type-event'),
                    action: '',
                    name: payload.eventName ?? '',
                };
            } else if (lowerCaseMethod.includes('user')) {
                notificationInfo = {
                    id: payload.username ?? '',
                    itemType: t('notifications.item-type-user'),
                    action: '',
                    name: payload.username ?? '',
                };
            } else if (lowerCaseMethod.includes('race')) {
                notificationInfo = {
                    id: payload.raceId ?? '',
                    itemType: t('notifications.item-type-race'),
                    action: '',
                    name: payload.raceId ?? '',
                };
            } else if (lowerCaseMethod.includes('model')) {
                console.info('NOTIFICATION', payload);
                notificationInfo = {
                    id: payload.modelId ?? '',
                    itemType: t('notifications.item-type-model'),
                    action: '',
                    name: payload.modelname ?? '',
                };
            } else if (lowerCaseMethod.includes('carlogsasset')) {
                console.info('NOTIFICATION', payload);
                notificationInfo = {
                    id: payload.assetId ?? '',
                    itemType: t('notifications.item-type-asset'),
                    action: '',
                    name: payload.filename ?? '',
                };
            } else if (lowerCaseMethod.includes('fleet')) {
                notificationInfo = {
                    id: payload.fleetId ?? '',
                    itemType: t('notifications.item-type-fleet'),
                    action: '',
                    name: payload.fleetName ?? '',
                };
            } else {
                notificationInfo = {
                    id: 'common',
                    itemType: 'unknown',
                    action: '',
                    name: '',
                };
            }

            let notificationHeader: string | undefined;
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
        [t, dispatch]
    );

    const generateResponseNotification = useCallback(
        (
            notificationInfo: NotificationInfo,
            status: MutationStatus,
            errorMessage?: string
        ): void => {
            let notificationHeader: string | undefined;
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
        [t, dispatch]
    );

    const send = useCallback(
        async (method: MutationMethod, payload: any): Promise<void> => {
            setIsLoading(true);
            setData(undefined);
            const notificationInfo = generateRequestNotification(method, payload);

            try {
                const response: any = await graphqlQuery(mutations[method], payload);
                setData({ ...response[method] });
                generateResponseNotification(notificationInfo, 'success');
                setIsLoading(false);
                setErrorMessage('');
            } catch (error: any) {
                generateResponseNotification(notificationInfo, 'error', error.errors[0].message);
                console.warn(error.errors[0].message);
                setIsLoading(false);
                setErrorMessage(error.errors[0].message);
                setData(undefined);
            }
        },
        [generateResponseNotification, generateRequestNotification]
    );

    return [send, isLoading, errorMessage, data];
}
