import { Auth } from 'aws-amplify';
import { useEffect, useState } from 'react';

/**
 * custom hook to get the permissions of the current user
 * @returns {Object} user permissions
 */
export const usePermissions = () => {
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

  return permissions;
};

const getPermissions = (groups) => {
  const defaultPermissions = {
    api: {
      // API:s used in globally shared contexts, used to control if they shall be invoked to fetch items or not
      fleets: false,
      events: false,
      users: false,
      races: false,
      cars: false,
      allModels: false,
    },
    sideNavItems: {
      registration: false,
      commentator: false,
      operator: false,
      admin: false,
    },
    topNavItems: {
      eventSelection: false,
    },
  };

  let permissions = defaultPermissions;

  // set topNavItems permissions
  if (groups.includes('admin') || groups.includes('operator') || groups.includes('commentator')) {
    permissions.topNavItems.eventSelection = true;
  }

  // Set sideNavItem permissions
  if (groups.includes('registration') || groups.includes('admin')) {
    const sideNavPermissions = { ...permissions.sideNavItems };
    permissions.sideNavItems = {
      ...sideNavPermissions,
      registration: true,
    };
  }
  if (groups.includes('commentator') || groups.includes('admin')) {
    const sideNavPermissions = { ...permissions.sideNavItems };
    permissions.sideNavItems = {
      ...sideNavPermissions,
      commentator: true,
    };
  }
  if (groups.includes('operator') || groups.includes('admin')) {
    const sideNavPermissions = { ...permissions.sideNavItems };
    permissions.sideNavItems = {
      ...sideNavPermissions,
      operator: true,
    };
  }
  if (groups.includes('admin')) {
    const sideNavPermissions = { ...permissions.sideNavItems };
    permissions.sideNavItems = {
      ...sideNavPermissions,
      admin: true,
    };
  }

  // Set API permissions
  if (groups.includes('operator') || groups.includes('admin')) {
    const apiPermissions = { ...permissions.api };
    permissions.api = {
      ...apiPermissions,
      fleets: true,
      events: true,
      users: true,
      races: true,
      cars: true,
      allModels: true,
    };
  } else if (groups.includes('registration')) {
    const apiPermissions = { ...permissions.api };
    permissions.api = {
      ...apiPermissions,
      users: true,
    };
  } else if (groups.includes('commentator')) {
    const apiPermissions = { ...permissions.api };
    permissions.api = {
      ...apiPermissions,
      events: true,
    };
  }

  return permissions;
};
