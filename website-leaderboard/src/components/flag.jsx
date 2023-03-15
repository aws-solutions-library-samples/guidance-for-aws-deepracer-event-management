
function countryToFlag(isoCode) {
    return typeof String.fromCodePoint !== 'undefined' ? isoCode
            .toUpperCase()
            .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
        : isoCode;
}

export function Flag(props) { 
    if(!props.countryCode) return undefined

    if (props.size === 'small') {
        return (
            <h3>{countryToFlag(props.countryCode)}</h3>
        )
    } else {
        return (
            <h1>{countryToFlag(props.countryCode)}</h1>
        )
    }
}