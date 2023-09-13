import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_USERS: (curState, users) => {
      console.debug('ADD_USERS DISPATCH FUNCTION', users);
      const updatedUsers = { ...curState.users };
      updatedUsers.users = users;
      return { users: updatedUsers };
    },
    UPDATE_USER: (curState, user) => {
      console.debug('UPDATE_USER DISPATCH FUNCTION', user);
      const updatedUsers = { ...curState.users };
      const userIndex = curState.users.users.findIndex((u) => u.sub === user.sub);
      if (userIndex === -1) {
        updatedUsers.users.push(user);
      } else {
        updatedUsers.users[userIndex] = user;
      }
      return { users: updatedUsers };
    },
    DELETE_USER: (curState, user) => {
      console.debug('DELETE_USER DISPATCH FUNCTION');
      const updatedUsers = { ...curState.users };
      return { users: updatedUsers.users.filter((u) => u.sub !== user.sub) };
    },
    USERS_IS_LOADING: (curState, isLoading) => {
      console.debug('USERS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedUsers = { ...curState.users };
      updatedUsers.isLoading = isLoading;
      return { users: updatedUsers };
    },
  };

  initStore(actions, { users: { users: [], isLoading: true } });
};

export default configureStore;
