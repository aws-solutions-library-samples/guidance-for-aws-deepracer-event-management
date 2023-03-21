import { Header } from '@cloudscape-design/components';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import useInterval from '../../hooks/useInterval';

const interval = 100;

const RaceTimer = forwardRef((props, ref) => {
    const [isRunning, setIsRunning] = useState(false);
    const [prevTime, setPrevTime] = useState(null);
    const [timeInMilliseconds, setTimeInMilliseconds] = useState(0);
    const [isExpired, SetIsExpired] = useState(false);
    const [time, setTime] = useState({
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
    });

    const { onExpire } = props;

    // Signal to parent that timer has expired
    useEffect(() => {
        if (isExpired) {
            onExpire();
        }
    }, [isExpired]); // TODO why does this trigger all the time when onExpire is set as dependency

    useImperativeHandle(ref, () => ({
        start() {
            // console.log('Start Timer');
            setPrevTime(null);
            setIsRunning(true);
        },
        pause() {
      setIsRunning(false);
        },
        reset(startingTime = 0) {
            // console.log('Reset race Timer =' + JSON.stringify(startingTime));
            setPrevTime(null);
            setTime(toTime(startingTime));
            setTimeInMilliseconds(startingTime);
            SetIsExpired(false);
            setIsRunning(false);
        },
        getCurrentTimeInMs() {
            return timeInMilliseconds;
        },
        getIsRunning() {
            return isRunning;
        },
    }));

    const toTime = (time) => {
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
            seconds,
            minutes,
            milliseconds,
        };
    };

    useInterval(
        () => {
            const prev = prevTime ? prevTime : Date.now();
            const diffTime = Date.now() - prev;
            const newMilliTime = timeInMilliseconds - diffTime;
            if (newMilliTime <= 0) {
                SetIsExpired(true);
                setIsRunning(false);
                setTimeInMilliseconds(0);
                setPrevTime(null);
                setTime(toTime(0));
            } else {
                setTimeInMilliseconds(newMilliTime);
                const newTime = toTime(newMilliTime);
                setPrevTime(Date.now());
                setTime(newTime);
            }
        },
        isRunning ? interval : null
    );

    return (
        <Header>
            {time.minutes}:{time.seconds}
        </Header>
    );
});

export default RaceTimer;
