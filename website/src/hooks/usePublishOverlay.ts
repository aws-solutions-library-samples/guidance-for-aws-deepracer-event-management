import { useEffect, useRef } from 'react';
import useMutation from './useMutation';

export enum RacesStatusEnum {
  NO_RACER_SELECTED = 'NO_RACER_SELECTED',
  READY_TO_START = 'READY_TO_START',
  RACE_IN_PROGRESS = 'RACE_IN_PROGRESS',
  RACE_PAUSED = 'RACE_PAUSED',
  RACE_FINSIHED = 'RACE_FINSIHED',
}

export interface OverlayInfo {
  eventId?: string;
  trackId?: string;
  username?: string;
  userId?: string;
  timeLeftInMs?: number;
  currentLapTimeInMs?: number;
  raceStatus?: RacesStatusEnum;
}

export const usePublishOverlay = (): [(callback: () => OverlayInfo, interval?: number) => void, () => void] => {
  const [SendMutation] = useMutation();
  const intervalTimerId = useRef<NodeJS.Timeout | undefined>();
  const lastMessage = useRef<OverlayInfo>({});

  const startPublish = (callback: () => OverlayInfo, interval: number = 5000): void => {
    if (intervalTimerId.current) stopPublish();

    const message = callback();
    Publish(message);

    intervalTimerId.current = setInterval(() => {
      console.debug('overlay - published: ' + intervalTimerId.current);

      const message = callback();
      Publish(message);
    }, interval);
  };

  const Publish = (message: OverlayInfo): void => {
    lastMessage.current = message;
    SendMutation('updateOverlayInfo', message);
  };

  const stopPublish = (): void => {
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
