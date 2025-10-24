import Paste from './PasteView';
import { render } from 'solid-js/web';

const root = document.getElementById('root');
if (root) {
    render(() => <Paste />, root);
}
