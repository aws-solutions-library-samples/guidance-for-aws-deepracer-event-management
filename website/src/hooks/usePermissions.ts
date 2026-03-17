import { useEffect, useState } from 'react';
import { getCurrentAuthUser } from './useAuth';

interface ApiPermissions {
    fleets: boolean;
    events: boolean;
    users: boolean;
    races: boolean;
    cars: boolean;
    allModels: boolean;
}

interface SideNavPermissions {
    registration: boolean;
    commentator: boolean;
    operator: boolean;
    admin: boolean;
}

interface TopNavPermissions {
    eventSelection: boolean;
}

export interface Permissions {
    api: ApiPermissions;
    sideNavItems: SideNavPermissions;
    topNavItems: TopNavPermissions;
}

/**
 * custom hook to get the permissions of the current user
 * @returns {Object} user permissions
 */
export const usePermissions = (): Permissions => {
    const [permissions, setPermissions] = useState<Permissions>(getPermissions([]));

    useEffect(() => {
        // Config Groups
        getCurrentAuthUser().then((authUser) => {
            setPermissions(getPermissions(authUser.groups));
        });

        return () => {
            // Unmounting
        };
    }, []);

    return permissions;
};

const getPermissions = (groups: string[]): Permissions => {
    const defaultPermissions: Permissions = {
        api: {
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

    let permissions: Permissions = defaultPermissions;

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
