import { API, graphqlOperation } from 'aws-amplify';
import { useState } from 'react';

import * as mutations from '../graphql/mutations';

export default function useMutation(method) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const send = (payload) => {
    const mutateApi = async () => {
      try {
        setLoading(true);
        const response = await API.graphql(graphqlOperation(mutations[method], payload));
        console.info(response);
        setLoading(false);
        setError('');
      } catch (error) {
        setError(error);
        setLoading(false);
      }
    };
    mutateApi();
    return () => {
      // abort();
    };
  };

  return { send, loading, error };
}
