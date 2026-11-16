import { startApp } from './shared/js/app.js';
import { initGuestbook } from './guestbook.js';

startApp({ layout: 'panel' });
initGuestbook();
