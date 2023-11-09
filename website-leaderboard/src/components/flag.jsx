function countryToFlag(isoCode) {
  return typeof String.fromCodePoint !== 'undefined'
    ? isoCode
        .toUpperCase()
        .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    : isoCode;
}

export function Flag(props) {
  if (!props.countryCode) return undefined;
  return <div style={props.style}>{countryToFlag(props.countryCode)}</div>;
}
