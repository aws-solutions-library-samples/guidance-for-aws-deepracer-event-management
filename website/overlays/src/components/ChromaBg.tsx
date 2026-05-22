import { useSearchParams } from 'react-router-dom';

export function ChromaBg() {
  const [searchParams] = useSearchParams();
  const enabled = searchParams.get('chroma') === '1';
  if (!enabled) return null;

  let colour = searchParams.get('chromaColor') || '00ff00';
  if (colour.length > 6) {
    // someone tries to cross-site script — override with default green
    colour = '00ff00';
  }
  return <div id="chromaBg" style={{ backgroundColor: `#${colour}` }} />;
}
