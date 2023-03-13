import React, { createContext } from 'react';
import { useUsersApi } from '../hooks/useUsersApi';

export const usersContext = createContext();

export const UsersProvider = (props) => {
  const [users, isLoading] = useUsersApi();

  return (
    // this is the provider providing state
    <usersContext.Provider value={[users, isLoading]}>{props.children}</usersContext.Provider>
  );
};
