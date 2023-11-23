import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_USERS: (curState, users) => {
      const updatedUsers = { ...curState.users };
      updatedUsers.users = users;
      return { users: updatedUsers };
    },
    UPDATE_USER: (curState, user) => {
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
      const updatedUsers = { ...curState.users };
      return { users: updatedUsers.users.filter((u) => u.sub !== user.sub) };
    },
    USERS_IS_LOADING: (curState, isLoading) => {
      const updatedUsers = { ...curState.users };
      updatedUsers.isLoading = isLoading;
      return { users: updatedUsers };
    },
  };

  initStore(actions, { users: { users: [], isLoading: true } });
};

export default configureStore;
