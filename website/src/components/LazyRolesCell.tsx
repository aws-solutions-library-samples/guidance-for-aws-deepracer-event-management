import { Spinner } from '@cloudscape-design/components';
import { useEffect, useState } from 'react';
import { graphqlQuery } from '../graphql/graphqlHelpers';
import { getUserRoles } from '../graphql/queries';

// Simple cache shared across all instances — survives re-renders but not page reloads
const rolesCache: Record<string, string | null> = {};

interface LazyRolesCellProps {
  username: string;
}

export const LazyRolesCell = ({ username }: LazyRolesCellProps) => {
  const [roles, setRoles] = useState<string | null>(rolesCache[username] ?? null);
  const [loading, setLoading] = useState<boolean>(!(username in rolesCache));

  useEffect(() => {
    if (username in rolesCache) {
      setRoles(rolesCache[username]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchRoles = async () => {
      try {
        const response = await graphqlQuery<{ getUserRoles: { Username: string; Roles: string[] } }>(
          getUserRoles,
          { username }
        );
        const userRoles = response.getUserRoles?.Roles;
        const rolesStr = userRoles && userRoles.length > 0 ? userRoles.join(', ') : '-';
        rolesCache[username] = rolesStr;
        if (!cancelled) {
          setRoles(rolesStr);
          setLoading(false);
        }
      } catch {
        rolesCache[username] = '-';
        if (!cancelled) {
          setRoles('-');
          setLoading(false);
        }
      }
    };
    fetchRoles();

    return () => { cancelled = true; };
  }, [username]);

  if (loading) return <Spinner size="normal" />;
  return <>{roles}</>;
};
