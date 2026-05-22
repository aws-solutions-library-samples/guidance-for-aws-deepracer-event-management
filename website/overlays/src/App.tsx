import { useSearchParams } from 'react-router-dom';
import OverlayLegacy from './OverlayLegacy';
import OverlayApp from './components/html/OverlayApp';

export default function App() {
  const [searchParams] = useSearchParams();
  const engine = searchParams.get('engine');
  return engine === 'html' ? <OverlayApp /> : <OverlayLegacy />;
}
