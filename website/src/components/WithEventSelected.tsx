import React, { ComponentType, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelectedEventContext } from '../store/contexts/storeProvider';
import { useStore } from '../store/store';
import { Event } from '../types/domain';
import { EventSelectorModal } from './eventSelectorModal';

/**
 * Higher-Order Component that ensures an event is selected before rendering the wrapped component
 * If no event is selected, displays an event selector modal
 * 
 * @param WrappedComponent - The component to wrap with event selection logic
 * @returns Component with event selection enforcement
 */
const WithEventSelected = <P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> => {
  const WithEventSelectedComponent = (props: P): JSX.Element => {
    const [eventSelectModalVisible, setEventSelectModalVisible] = useState<boolean>(false);
    const selectedEvent = useSelectedEventContext() as Event;
    const [, dispatch] = useStore();
    const navigate = useNavigate();

    // Show event selector modal if no event has been selected
    useEffect(() => {
      if (selectedEvent.eventId == null) {
        setEventSelectModalVisible(true);
      }
    }, [selectedEvent, eventSelectModalVisible]);

    if (eventSelectModalVisible) {
      return (
        <EventSelectorModal
          visible={eventSelectModalVisible}
          onDismiss={() => {
            navigate('/');
            dispatch('SIDE_NAV_IS_OPEN', true);
          }}
          onOk={() => setEventSelectModalVisible(false)}
        />
      );
    } else {
      return <WrappedComponent {...props} />;
    }
  };

  return WithEventSelectedComponent;
};

export default WithEventSelected;
