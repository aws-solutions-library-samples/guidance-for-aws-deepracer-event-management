import { TextContent } from '@cloudscape-design/components';

function countryToFlag(isoCode) {
    return typeof String.fromCodePoint !== 'undefined' ? isoCode
            .toUpperCase()
            .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
        : isoCode;
}

export function Flag(props) { 
    if (props.size === 'small') {
        return (
            <TextContent>
                <h3>{countryToFlag(props.countryCode)}</h3>
            </TextContent>
        )
    } else {
        return (
            <TextContent>
                <h1>{countryToFlag(props.countryCode)}</h1>
            </TextContent>
        )
    }
}