import { useCallback } from 'react';
import { useStore } from '../store/store';
import { User } from '../types/api-responses';

/**
 * React custom hook for accessing users
 * @returns array [users, isLoading, getUserNameFromId]
 *
 * @example
 * const [users, isLoading, getUserNameFromId] = useUsers();
 */
export const useUsers = (): [User[], boolean, (userId: string | null | undefined) => string | undefined] => {
  const [state] = useStore();
  const users: User[] = state.users?.users || [];
  const isLoading: boolean = state.users?.isLoading || false;

  /**
   * [getUserNameFromId retrieve the username for a userId]
   * @param {string} userId [the id of the user to lookup]
   * @returns {string} [username for the given userId, will return userId if the user can't be found]
   */
  const getUserNameFromId = useCallback(
    (userId: string | null | undefined): string | undefined => {
      if (userId == null) return undefined;

      const user = users.find((user) => user.sub === userId);
      if (user == null) return userId;

      return user.Username;
    },
    [users]
  );

  return [users, isLoading, getUserNameFromId];
};
