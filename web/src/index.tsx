import App from './app.tsx';
import { render } from 'solid-js/web';

const root = document.getElementById('root');
if (root) {
    render(() => <App />, root);
}
