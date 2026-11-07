import { createStore } from './state.js';
import { createEngine } from './engine/index.js';
import { initUI } from './ui/index.js';

const store = createStore();
const engine = createEngine(document.getElementById('stage'), store);
initUI({ store, engine });
if (false) window.__casa = { store, engine };
