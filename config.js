'use strict';

/* Paint Runner shares the Firebase project with Quizzle. These settings are public by
   design; what anyone can read or write is decided by the rules in firestore.rules. */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDJ3zumTbSC7load6wjOXisfre6UuyeC4w',
  authDomain: 'quizzle-a3132.firebaseapp.com',
  projectId: 'quizzle-a3132',
  storageBucket: 'quizzle-a3132.firebasestorage.app',
  messagingSenderId: '89417063490',
  appId: '1:89417063490:web:7b2ef5b95a0519f97161db',
};

// The account that can open the stats dashboard (also enforced in firestore.rules).
const ADMIN_EMAIL = 'filossof@gmail.com';
