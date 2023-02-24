import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
// import * as mutations from '../graphql/mutations';

export const useUsersApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  //const [errorMessage, setErrorMessage] = useState('');

  // initial data load
  useEffect(() => {
    async function listUsers() {
      setIsLoading(true);
      const response = await API.graphql({
        query: queries.listUsers,
      });
      setUsers([...response.data.listUsers]);
      setIsLoading(false);
    }
    listUsers();

    return () => {
      // Unmounting
    };
  }, []);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(onUserCreated)).subscribe({
      next: (event) => {
        console.log(event);
        setUsers([...users, event.value.data.onUserCreated]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [users]);

  return [users, isLoading]; //, errorMessage];
};
