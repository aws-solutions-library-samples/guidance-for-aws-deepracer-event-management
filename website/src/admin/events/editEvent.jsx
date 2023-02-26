import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ContentHeader } from '../../components/contentHeader';
import useMutation from '../../hooks/useMutation';
import { merge } from '../../support-functions/merge';
import { CarFleetPanel } from './carFleetPanel';
import { event } from './eventDomain';
import { EventInfoPanel } from './generalInfoPanel';
import { RacePanel } from './racePanel';

export const EditEvent = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const selectedEvent = location.state;
    const navigate = useNavigate();

    const [send, loading, errorMessage, data] = useMutation();
    const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState(false);
    const [eventConfig, setEventConfig] = useState(event);

    useEffect(() => {
        if (!loading && data && !errorMessage) {
            navigate(-1);
        }
    }, [loading, data, errorMessage, navigate]);

    const UpdateConfigHandler = (attr) => {
        setEventConfig((prevState) => {
            return merge({ ...prevState }, attr);
        });
    };

    useEffect(() => {
        if (selectedEvent) {
            setEventConfig(selectedEvent);
        }
    }, [selectedEvent]);

    const onSaveEventHandler = async () => {
        send('updateEvent', eventConfig);
    };

    const formIsValidHandler = () => {
        setCreateButtonIsDisabled(false);
    };

    const formIsInvalidHandler = () => {
        setCreateButtonIsDisabled(true);
    };

    return (
        <>
            <ContentHeader
                header={t('events.edit-event')}
                description={t('events.description')}
                breadcrumbs={[
                    { text: t('home.breadcrumb'), href: '/' },
                    { text: t('admin.breadcrumb'), href: '/admin/home' },
                    { text: t('events.breadcrumb'), href: '/admin/events' },
                    { text: t('events.edit-event') },
                ]}
            />
            <form onSubmit={(event) => event.preventDefault()}>
                <Form
                    actions={
                        <SpaceBetween direction="horizontal" size="xs">
                            <Button variant="link" onClick={() => navigate(-1)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={onSaveEventHandler}
                                disabled={loading || createButtonIsDisabled}
                            >
                                Save Changes
                            </Button>
                        </SpaceBetween>
                    }
                    errorText={errorMessage}
                    errorIconAriaLabel="Error"
                >
                    <SpaceBetween size="l">
                        <EventInfoPanel
                            {...eventConfig}
                            onChange={UpdateConfigHandler}
                            onFormIsValid={formIsValidHandler}
                            onFormIsInvalid={formIsInvalidHandler}
                        />
                        <RacePanel
                            tracks={eventConfig.tracks}
                            onChange={UpdateConfigHandler}
                            onFormIsValid={formIsValidHandler}
                            onFormIsInvalid={formIsInvalidHandler}
                        />
                        <CarFleetPanel
                            fleetId={eventConfig.fleetId}
                            onChange={UpdateConfigHandler}
                        />
                    </SpaceBetween>
                </Form>
            </form>
        </>
    );
};
