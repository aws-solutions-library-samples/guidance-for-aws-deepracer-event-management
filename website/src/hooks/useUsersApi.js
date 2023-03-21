import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
import { onUserCreated } from '../graphql/subscriptions';
// import * as mutations from '../graphql/mutations';

export const useUsersApi = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  //const [errorMessage, setErrorMessage] = useState('');

  // initial data load
  useEffect(() => {
    async function listUsers() {
      setIsLoading(true);
      const response = await API.graphql({
        query: queries.listUsers,
        authMode: 'AMAZON_COGNITO_USER_POOLS',
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

    // const subscription = API.graphql({
    //   ...graphqlOperation(onUserCreated),
    //   authMode: 'AMAZON_COGNITO_USER_POOLS',
    // }).subscribe({
    //   next: (event) => {
    //     console.log(event);
    //     setUsers([...users, event.value.data.onUserCreated]);
    //   },
    // });

    return () => {
      subscription.unsubscribe();
    };
  }, [users]);

  return [users, isLoading]; //, errorMessage];
};
