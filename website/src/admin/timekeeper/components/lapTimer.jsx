import { Header } from '@cloudscape-design/components';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import useInterval from '../../../hooks/useInterval';

const interval = 10;

const LapTimer = forwardRef((props, ref) => {
  const isRunning = useRef(false);
  const prevTime = useRef(null);
  const timeInMilliseconds = useRef(0);
  const [time, setTime] = useState({
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  useImperativeHandle(ref, () => ({
    start() {
      isRunning.current = true;
      prevTime.current = null;
    },
    pause() {
      isRunning.current = false;
    },
    reset(startingTime = 0) {
      prevTime.current = null;
      timeInMilliseconds.current = startingTime;
      setTime((prevState) => toTime(startingTime));
    },
    getCurrentTimeInMs() {
      return timeInMilliseconds.current;
    },
    getIsRunning() {
      return isRunning.current;
    },
  }));

  const toTime = useCallback((time) => {
    let milliseconds = parseInt(time % 1000, 10);
    let seconds = Math.floor((time / 1000) % 60);
    let minutes = Math.floor(time / (1000 * 60));

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    if (milliseconds < 10) {
      milliseconds = '00' + milliseconds;
    } else if (milliseconds < 100) {
      milliseconds = '0' + milliseconds;
    }

    return {
      milliseconds,
      seconds,
      minutes,
    };
  }, []);

  useInterval(
    () => {
      const prev = prevTime.current ? prevTime.current : Date.now();
      const diffTime = Date.now() - prev;
      const newMilliTime = timeInMilliseconds.current + diffTime;
      timeInMilliseconds.current = newMilliTime;
      const newTime = toTime(newMilliTime);
      prevTime.current = Date.now();
      setTime((prevState) => newTime);
    },
    isRunning.current ? interval : null
  );

  return (
    <Header>
      {time.minutes}:{time.seconds}:{time.milliseconds}
    </Header>
  );
});

export default LapTimer;
