import { TextContent } from '@cloudscape-design/components';

function countryToFlag(isoCode) {
    return typeof String.fromCodePoint !== 'undefined' ? isoCode
            .toUpperCase()
            .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
        : isoCode;
}

export function Flag(props) { 
    return (
        <TextContent>
            <h1>{countryToFlag(props.countryCode)}</h1>
        </TextContent>
    )
}