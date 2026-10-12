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

// The account that can open the stats dashboard (also enforced in firestore.rules).
const ADMIN_EMAIL = 'filossof@gmail.com';
