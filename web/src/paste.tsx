import { render } from 'solid-js/web';
import Paste from './PasteView';

const root = document.getElementById('root');
if (root) {
    render(() => <Paste />, root);
}
