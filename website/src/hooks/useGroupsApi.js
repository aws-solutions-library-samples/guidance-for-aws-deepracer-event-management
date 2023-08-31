import { API } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';

export const useGroupsApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // initial data load
  useEffect(() => {
    async function getGroups() {
      setIsLoading(true);
      const responseGetGroups = await API.graphql({
        query: queries.listGroups,
      });
      const groups = responseGetGroups.data.listGroups;
      console.debug(groups);
      setGroups(groups);
      setIsLoading(false);
    }
    getGroups();

    return () => {
      // Unmounting
    };
  }, []);

  return [groups, isLoading, errorMessage];
};
