import { Auth } from 'aws-amplify';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getPermissions } from './helper-functions/permissions';

const permissionContext = createContext();
export function usePermissionsContext() {
  return useContext(permissionContext);
}

export const PermissionProvider = (props) => {
  const [permissions, setPermissions] = useState(getPermissions([]));

  useEffect(() => {
    // Config Groups
    Auth.currentAuthenticatedUser().then((user) => {
      const groups = user.signInUserSession.accessToken.payload['cognito:groups'];
      if (groups !== undefined) {
        setPermissions(getPermissions(groups));
      }
    });

    return () => {
      // Unmounting
    };
  }, []);

  return (
    <permissionContext.Provider value={permissions}>{props.children}</permissionContext.Provider>
  );
};
