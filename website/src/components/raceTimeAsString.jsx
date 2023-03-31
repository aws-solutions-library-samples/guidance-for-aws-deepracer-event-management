
const RaceTimeAsString = ({timeInMS, showMills = true}) => {

    const convertMsToString = (timeInMS) => {
        const millisecondsAsString = String(Math.floor(timeInMS % 1000)).padStart(3, '0');
        
        const seconds = Math.floor(timeInMS / 1000);
        const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secondsAsString = String(seconds % 60).padStart(2, '0');

        let timeAsString = `${minutesAsString}:${secondsAsString}`;
        if( showMills ) timeAsString = timeAsString + `.${millisecondsAsString}`
        return timeAsString;
      }

    return (
        <>{timeInMS ? convertMsToString(timeInMS) : '-'}</>
    )
}

export { RaceTimeAsString };
