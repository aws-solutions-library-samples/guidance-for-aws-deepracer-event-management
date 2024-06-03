import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useSelectedEventContext
} from '../store/contexts/storeProvider';
import { useStore } from '../store/store';

import { EventSelectorModal } from "./eventSelectorModal";

const WithEventSelected = (WrappedComponent) => {
    const WithEventSelected = (props) => {
        const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);
        const selectedEvent = useSelectedEventContext();
        const [, dispatch] = useStore();
        const navigate = useNavigate();

        // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
        useEffect(() => {
            if (selectedEvent.eventId == null) {
            setEventSelectModalVisible(true);
            }
        }, [selectedEvent, eventSelectModalVisible]);

        if (eventSelectModalVisible){
            return <EventSelectorModal
            visible={eventSelectModalVisible}
            onDismiss={() => {
                navigate('/');
                dispatch('SIDE_NAV_IS_OPEN', true);
            }}
            onOk={() => setEventSelectModalVisible(false)}
        />
        } else {
            return <WrappedComponent {...props} />;
        }
    }
    return WithEventSelected;
}

export default WithEventSelected;