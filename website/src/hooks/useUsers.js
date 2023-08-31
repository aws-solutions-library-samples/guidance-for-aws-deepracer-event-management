import { useCallback } from 'react';
import { useStore } from '../store/store';

/**
 * React custom hook for accessing users
 * @returns array [users, isLoading, getUserNameFromId]
 *
 * @example
 * const [users, isLoading, getUserNameFromId] = useUsers();
 */
export const useUsers = () => {
  const [state] = useStore();
  const users = state.users.users;
  const isLoading = state.users.isLoading;

  /**
   * [getUserNameFromId retrieve the username for a userId]
   * @param {string} userId [the id of the user to lookup]
   * @returns {string} [username for the given userId, will return userId if the user cna´t be found]
   */
  const getUserNameFromId = useCallback(
    (userId) => {
      if (userId == null) return;

      const user = users.find((user) => user.sub === userId);
      if (user == null) return userId;

      return user.Username;
    },
    [users]
  );

  return [users, isLoading, getUserNameFromId];
};
