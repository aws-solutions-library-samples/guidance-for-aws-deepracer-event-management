import { TextContent } from '@cloudscape-design/components';

/**
 * Converts an ISO country code to its corresponding flag emoji
 * @param isoCode - Two-letter ISO country code (e.g., 'US', 'GB')
 * @returns Flag emoji string or undefined if no code provided
 */
function countryToFlag(isoCode: string | null | undefined): string | undefined {
  if (isoCode == null) return undefined;

  return typeof String.fromCodePoint !== 'undefined'
    ? isoCode
        .toUpperCase()
        .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    : isoCode;
}

/**
 * Props interface for the Flag component
 */
interface FlagProps {
  /** Two-letter ISO country code (e.g., 'US', 'GB') */
  countryCode: string | null | undefined;
  /** Size variant for the flag display */
  size?: 'small' | 'large';
}

/**
 * Flag component that displays a country flag emoji based on ISO country code
 * @param props - Component props
 * @returns Rendered flag component
 */
export function Flag({ countryCode, size = 'large' }: FlagProps): JSX.Element {
  if (size === 'small') {
    return (
      <TextContent>
        <h3>{countryToFlag(countryCode)}</h3>
      </TextContent>
    );
  }
  
  return (
    <TextContent>
      <h1>{countryToFlag(countryCode)}</h1>
    </TextContent>
  );
}
