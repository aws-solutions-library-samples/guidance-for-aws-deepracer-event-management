import { AppLayout, Badge, SideNavigation, TopNavigation } from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useContext, useEffect, useState } from 'react';

import { Route, Routes, useLocation } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import { AdminActivation } from '../admin/carActivation';
import { AdminCars } from '../admin/cars';
import { AdminEvents } from '../admin/events/adminEvents';
import { CreateEvent } from '../admin/events/createEvent';
import { EditEvent } from '../admin/events/editEvent';
import { AdminFleets } from '../admin/fleets/adminFleets';
import { CreateFleet } from '../admin/fleets/createFleet';
import { EditFleet } from '../admin/fleets/editFleet';
import { AdminGroupsDetail } from '../admin/groups/detail';
import { AdminGroups } from '../admin/groups/groups';
import { AdminHome } from '../admin/home';
import { AdminModels } from '../admin/models';
import { AdminQuarantine } from '../admin/quarantine';
import { Timekeeper } from '../admin/timekeeper/timeKeeper';
import { CreateUser } from '../admin/users/createUser';
import { Home } from '../home';
import useLink from '../hooks/useLink';
import { Models } from '../models';
import { eventContext } from '../store/eventProvider';
import SideNavContext from '../store/sideNavContext';
import { Upload } from '../upload';

function cwr(operation, payload) {
    // Instrument Routing to Record Page Views
    // https://github.com/aws-observability/aws-rum-web/blob/main/docs/cdn_react.md
    return void 0;
}

function usePageViews() {
    const location = useLocation();
    React.useEffect(() => {
        // console.log(location.pathname);
        cwr('recordPageView', location.pathname);
    }, [location]);
}

function MenuRoutes() {
    usePageViews();
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/models" element={<Models />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/admin/home" element={<AdminHome />} />
            <Route path="/admin/models" element={<AdminModels />} />
            <Route path="/admin/quarantine" element={<AdminQuarantine />} />
            <Route path="/admin/cars" element={<AdminCars />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/events/create" element={<CreateEvent />} />
            <Route path="/admin/events/edit" element={<EditEvent />} />
            <Route path="/admin/fleets" element={<AdminFleets />} />
            <Route path="/admin/fleets/create" element={<CreateFleet />} />
            <Route path="/admin/fleets/edit" element={<EditFleet />} />
            <Route path="/admin/createUser" element={<CreateUser />} />
            <Route path="/admin/groups" element={<AdminGroups />} />
            <Route path="/admin/groups/:groupName" element={<AdminGroupsDetail />} />
            <Route path="/admin/car_activation" element={<AdminActivation />} />
            <Route path="/admin/timekeeper" element={<Timekeeper />} />
            <Route path="*" element={<Home />} />
        </Routes>
    );
}

export function TopNav(props) {
    const { t } = useTranslation();

    const [groups, setGroups] = useState([]);
    const [navigationOpen, setNavigationOpen] = useState(true);
    const { handleFollow } = useLink();

    const { events, selectedEvent, setSelectedEvent } = useContext(eventContext);

    useEffect(() => {
        // Config Groups
        Auth.currentAuthenticatedUser().then((user) => {
            const groups = user.signInUserSession.accessToken.payload['cognito:groups'];
            if (groups !== undefined) {
                setGroups(groups);
            }
        });

        return () => {
            // Unmounting
        };
    }, []);

    const navItems = [
        { type: 'link', text: t('topnav.upload'), href: '/upload' },
        { type: 'link', text: t('topnav.models'), href: '/models' },
    ];

    if (groups.includes('admin')) {
        navItems.push({
            type: 'section',
            text: t('topnav.admin'),
            href: '/admin',
            items: [
                {
                    type: 'expandable-link-group',
                    text: t('topnav.models'),
                    items: [
                        { type: 'link', text: t('topnav.all-models'), href: '/admin/models' },
                        {
                            type: 'link',
                            text: t('topnav.quarantined-models'),
                            href: '/admin/quarantine',
                        },
                    ],
                },
                {
                    type: 'expandable-link-group',
                    text: t('topnav.car-management'),
                    items: [
                        { type: 'link', text: t('topnav.fleets'), href: '/admin/fleets' },
                        { type: 'link', text: t('topnav.cars'), href: '/admin/cars' },
                        {
                            type: 'link',
                            text: t('topnav.car-activation'),
                            href: '/admin/car_activation',
                        },
                    ],
                },
                {
                    type: 'expandable-link-group',
                    text: t('topnav.event'),
                    items: [
                        {
                            type: 'link',
                            text: t('topnav.events'),
                            info: <Badge color="blue">Beta</Badge>,
                            href: '/admin/events',
                        },
                        {
                            type: 'link',
                            text: t('topnav.time-keeper'),
                            info: <Badge color="blue">Beta</Badge>,
                            href: '/admin/timekeeper',
                        },
                    ],
                },
                { type: 'link', text: t('topnav.groups'), href: '/admin/groups' },
                { type: 'link', text: t('topnav.create-user'), href: '/admin/createuser' },
            ],
        });
    }

    return (
        <div>
            <SideNavContext.Provider value={{ navigationOpen, setNavigationOpen }}>
                <div id="h" style={{ position: 'sticky', top: 0, zIndex: 1002 }}>
                    <TopNavigation
                        identity={{
                            href: '/',
                            title: 'DREM',
                            logo: {
                                src: '/logo.png',
                                alt: 'DREM',
                            },
                        }}
                        utilities={[
                            {
                                type: 'menu-dropdown',
                                text: selectedEvent.eventName,
                                items: events.map((event) => {
                                    return { id: event.eventId, text: event.eventName };
                                }),
                                onItemClick: ({ detail }) => {
                                    setSelectedEvent(
                                        events.find((item) => item.eventId === detail.id)
                                    );
                                },
                            },
                            {
                                type: 'menu-dropdown',
                                text: props.user,
                                iconName: 'user-profile',
                                items: [
                                    {
                                        id: 'signout',
                                        text: t('topnav.sign-out'),
                                    },
                                ],
                                onItemClick: ({ detail }) => {
                                    if (detail.id === 'signout') {
                                        props.signout();
                                    }
                                },
                            },
                        ]}
                        i18nStrings={{
                            searchIconAriaLabel: t('topnav.search'),
                            searchDismissIconAriaLabel: t('topnav.close-search'),
                            overflowMenuTriggerText: t('topnav.more'),
                            overflowMenuTitleText: t('topnav.all'),
                            overflowMenuBackIconAriaLabel: t('topnav.back'),
                            overflowMenuDismissIconAriaLabel: t('topnav.close-menu'),
                        }}
                    />
                </div>
                <AppLayout
                    // stickyNotifications
                    toolsHide
                    // headerSelector="#header"
                    ariaLabels={{ navigationClose: 'close' }}
                    navigationOpen={navigationOpen}
                    navigation={
                        <SideNavigation
                            activeHref={window.location.pathname}
                            onFollow={handleFollow}
                            items={navItems}
                        />
                    }
                    // breadcrumbs={<BreadcrumbGroup items={breadcrumbs} expandAriaLabel="Show path" ariaLabel="Breadcrumbs" />}
                    contentType="table"
                    content={<MenuRoutes />}
                    onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
                />
            </SideNavContext.Provider>
        </div>
    );
}

export default TopNav;