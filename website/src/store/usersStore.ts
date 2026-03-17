import { initStore } from './store';
import { GlobalState, UsersState } from './storeTypes';
import { User } from '../types/api-responses';

const configureStore = (): void => {
  const actions = {
    ADD_USERS: (curState: GlobalState, users: User[]): Partial<GlobalState> => {
      const updatedUsers: UsersState = { ...(curState.users || { users: [], isLoading: false }) };
      updatedUsers.users = users;
      return { users: updatedUsers };
    },
    UPDATE_USER: (curState: GlobalState, user: User): Partial<GlobalState> => {
      const currentUsers = curState.users?.users || [];
      const updatedUsers: UsersState = { ...(curState.users || { users: [], isLoading: false }) };
      const userIndex = currentUsers.findIndex((u) => u.sub === user.sub);
      if (userIndex === -1) {
        updatedUsers.users.push(user);
      } else {
        updatedUsers.users[userIndex] = user;
      }
      return { users: updatedUsers };
    },
    DELETE_USER: (curState: GlobalState, user: User): Partial<GlobalState> => {
      const currentUsers = curState.users?.users || [];
      const updatedUsers: UsersState = { 
        ...(curState.users || { users: [], isLoading: false }),
        users: currentUsers.filter((u) => u.sub !== user.sub)
      };
      return { users: updatedUsers };
    },
    USERS_IS_LOADING: (curState: GlobalState, isLoading: boolean): Partial<GlobalState> => {
      const updatedUsers: UsersState = { ...(curState.users || { users: [], isLoading: false }) };
      updatedUsers.isLoading = isLoading;
      return { users: updatedUsers };
    },
  };

  initStore(actions, { users: { users: [], isLoading: true } });
};

export default configureStore;
