import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
import { onUserCreated } from '../graphql/subscriptions';
// import * as mutations from '../graphql/mutations';

export const useUsersApi = (userHasAccess = false) => {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  //const [errorMessage, setErrorMessage] = useState('');

  function getUserEmail(item) {
    const email = item.Attributes.filter((obj) => {
      return obj.Name === 'email';
    });
    if (email.length > 0) {
      return email[0].Value;
    }
  }

  function getUserCountryCode(item) {
    const countryCode = item.Attributes.filter((obj) => {
      return obj.Name === 'custom:countryCode';
    });
    return countryCode.length > 0 ? countryCode[0].Value : '';
  }

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      async function listUsers() {
        setIsLoading(true);
        const response = await API.graphql({
          query: queries.listUsers,
          authMode: 'AMAZON_COGNITO_USER_POOLS',
        });
        const tempUsers = response.data.listUsers;

        const users = tempUsers.map((u) => ({
          ...u,
          Email: getUserEmail(u),
          CountryCode: getUserCountryCode(u),
        }));
        setUsers([...users]);
        setIsLoading(false);
      }
      listUsers();
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let subscription;
    if (userHasAccess) {
      subscription = API.graphql(graphqlOperation(onUserCreated)).subscribe({
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
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [users, userHasAccess]);

  return [users, isLoading]; //, errorMessage];
};
