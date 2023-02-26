import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';

import * as queries from '../graphql/queries';

export default function useQuery(method, params = '') {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const queryApi = async () => {
      try {
        setLoading(true);
        const response = await API.graphql(graphqlOperation(queries[method], params));
        setData(response.data[method]);
        setLoading(false);
      } catch (error) {
        setError(error);
        setLoading(false);
      }
    };
    queryApi();
    return () => {
      // abort();
    };
  }, [method]);

  return [data, loading, error];
}
