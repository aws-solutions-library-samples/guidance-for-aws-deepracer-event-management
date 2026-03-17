import { initStore } from './store';
import { GlobalState, Notification } from './storeTypes';

const configureStore = (): void => {
  const actions = {
    ADD_NOTIFICATION: (curState: GlobalState, notification: Notification): Partial<GlobalState> => {
      console.debug('ADD_NOTIFICATION DISPATCH FUNCTION', notification);
      const currentNotifications = curState.notifications?.notifications || [];
      const updatedNotifications: Notification[] = [...currentNotifications];
      const index = updatedNotifications.findIndex((n) => n.id === notification.id);
      if (index > -1) updatedNotifications[index] = notification;
      else updatedNotifications.push(notification);
      return { notifications: { notifications: updatedNotifications } };
    },
    DISMISS_NOTIFICATION: (curState: GlobalState, notificationId: string): Partial<GlobalState> => {
      console.debug('DISMISS_NOTIFICATION DISPATCH FUNCTION', notificationId);
      const currentNotifications = curState.notifications?.notifications || [];
      const updatedNotifications: Notification[] = [...currentNotifications];
      return { notifications: { notifications: updatedNotifications.filter((n) => n.id !== notificationId) } };
    },
  };

  initStore(actions, { notifications: { notifications: [] } });
};

export default configureStore;
