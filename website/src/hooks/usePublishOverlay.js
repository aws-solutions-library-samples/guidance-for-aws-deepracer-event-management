import { useEffect, useRef } from 'react';
import useMutation from './useMutation';

export const RacesStatusEnum = {
  NO_RACER_SELECTED: 'NO_RACER_SELECTED',
  READY_TO_START: 'READY_TO_START',
  RACE_IN_PROGRESS: 'RACE_IN_PROGRESS',
  RACE_PAUSED: 'RACE_PAUSED',
  RACE_FINSIHED: 'RACE_FINSIHED',
};

export const OverlayInfo = {
  eventId: undefined,
  username: undefined,
  userId: undefined,
  timeLeftInMs: undefined,
  currentLapTimeInMs: undefined,
  raceStatusEnum: undefined,
};

export const usePublishOverlay = () => {
  const [SendMutation] = useMutation();
  let intervalTimerId = useRef();
  let lastMessage = useRef();

  const startPublish = (callback, interval = 5000) => {
    if (intervalTimerId.current) stopPublish();

    const message = callback();
    Publish(message);

    intervalTimerId.current = setInterval(() => {
      console.debug('overlay - published: ' + intervalTimerId.current);

      const message = callback();
      Publish(message);
    }, interval);
  };

  const Publish = (message) => {
    lastMessage.current = message;
    SendMutation('updateOverlayInfo', message);
  };
  const stopPublish = () => {
    if (intervalTimerId) {
      clearInterval(intervalTimerId.current);
      intervalTimerId.current = undefined;
    }
  };

  useEffect(() => {
    return () => {
      console.debug('STOP OVERLAY PUBLISHING - UNMOUNT');
      stopPublish();

      const message = {
        eventId: lastMessage.current.eventId,
        trackId: lastMessage.current.trackId,
        username: lastMessage.current.username,
        userId: lastMessage.current.userId,
        raceStatus: RacesStatusEnum.RACE_FINSIHED,
      };
      SendMutation('updateOverlayInfo', message);
    };
  }, [SendMutation]);

  return [startPublish, stopPublish];
};
