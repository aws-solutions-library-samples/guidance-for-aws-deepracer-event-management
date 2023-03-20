import React, { createContext } from 'react';
import { useUsersApi } from '../hooks/useUsersApi';

export const usersContext = createContext();

export const UsersProvider = (props) => {
  const [users, isLoading] = useUsersApi();

  const getUserNameFromId = (userId) => {
    if (userId == null) return;

    const user = users.find((user) => user.sub === userId);
    if (user == null) return userId;

    return user.Username;
  };

  return (
    // this is the provider providing state
    <usersContext.Provider value={[users, isLoading, getUserNameFromId]}>
      {props.children}
    </usersContext.Provider>
  );
};
