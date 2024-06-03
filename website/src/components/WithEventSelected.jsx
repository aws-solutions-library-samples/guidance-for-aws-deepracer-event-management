import React, { useEffect, useState } from 'react';
import {
    useSelectedEventContext
} from '../store/contexts/storeProvider';

import { EventSelectorModal } from "./eventSelectorModal";

const WithEventSelected = (WrappedComponent) => {
    const WithEventSelected = (props) => {
        const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);
        const selectedEvent = useSelectedEventContext();

        // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
        useEffect(() => {
            if (selectedEvent.eventId == null) {
            setEventSelectModalVisible(true);
            }
        }, [selectedEvent, eventSelectModalVisible]);

        if (eventSelectModalVisible){
            return <EventSelectorModal
            visible={eventSelectModalVisible}
            onDismiss={() => setEventSelectModalVisible(false)}
            onOk={() => setEventSelectModalVisible(false)}
        />
        } else {
            return <WrappedComponent {...props} />;
        }
    }
    return WithEventSelected;
}

export default WithEventSelected;