'use strict';

/* Paint Runner's own Firebase project. These settings are public by design; what anyone
   can read or write is decided by the rules in firestore.rules. */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBrfNYu5ieyX7PZWWg1oXtadXSe1ZBKpwA',
  authDomain: 'paintrunner.firebaseapp.com',
  projectId: 'paintrunner',
  storageBucket: 'paintrunner.firebasestorage.app',
  messagingSenderId: '608858601012',
  appId: '1:608858601012:web:e1defa6910c915630d3c61',
};

// What the player is on: 'phone', 'tablet' or 'computer'. A touchscreen as the main pointer means a
// phone or tablet (the shorter screen side tells them apart); touch laptops count as computers.
const DEVICE = (() => {
  try {
    if (!matchMedia('(pointer: coarse)').matches) return 'computer';
    return Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
  } catch (e) { return 'computer'; }
})();

// Where the 💛 Support button goes: itch.io's donate window for the game.
const SUPPORT_URL = 'https://filossof.itch.io/paint-runner/donate';

// The account that can open the stats dashboard (also enforced in firestore.rules).
const ADMIN_EMAIL = 'filossof@gmail.com';
