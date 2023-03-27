export const getPermissions = (groups) => {
  const defaultPermissions = {
    api: {
      // API:s used in globally shared contexts, used to controll if they shall be invoked to fetch items or not
      fleets: false,
      events: false,
      users: false,
      cars: false,
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
  if (
    groups.includes('admin') ||
    groups.includes('operator') ||
    groups.includes('commentator') ||
    groups.includes('registration')
  ) {
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
      cars: true,
    };
  }

  return permissions;
};
