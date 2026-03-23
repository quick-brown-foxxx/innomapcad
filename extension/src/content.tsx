import { createRoot } from 'react-dom/client';

function App(): React.JSX.Element {
  return <div data-testid="innomap-panel">InnoMapCAD loaded</div>;
}

function mountExtension(): void {
  const host = document.createElement('div');
  host.id = 'innomapcad-root';
  const shadow = host.attachShadow({ mode: 'open' });

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  document.body.appendChild(host);

  const root = createRoot(mountPoint);
  root.render(<App />);
}

mountExtension();
