import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_NOTIFICATION: (curState, notification) => {
      console.debug('ADD_NOTIFICATION DISPATCH FUNCTION', notification);
      const updatedNotifications = [...curState.notifications];
      const index = updatedNotifications.findIndex((n) => n.id === notification.id);
      if (index > -1) updatedNotifications[index] = notification;
      else updatedNotifications.push(notification);
      return { notifications: updatedNotifications };
    },
    DISMISS_NOTIFICATION: (curState, notificationId) => {
      console.debug('DISMISS_NOTIFICATION DISPATCH FUNCTION', notificationId);
      const updatedNotifications = [...curState.notifications];
      return { notifications: updatedNotifications.filter((n) => n.id !== notificationId) };
    },
  };

  initStore(actions, { notifications: [] });
};

export default configureStore;
