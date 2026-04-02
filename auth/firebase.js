// ================================================================
// IPORDISE — Firebase App Initialisation (SDK v10 Modular CDN)
// ================================================================
//
//  SETUP INSTRUCTIONS:
//  1. Go to https://console.firebase.google.com
//  2. Create a project (or open an existing one)
//  3. Project Settings → Your apps → "Add app" (Web)
//  4. Copy the firebaseConfig object and paste it below
//  5. Enable Authentication → Sign-in methods:
//       ✓ Email/Password
//       ✓ Google (optional)
//
// ================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4',
  authDomain:        'ipordise-aef54.firebaseapp.com',
  projectId:         'ipordise-aef54',
  storageBucket:     'ipordise-aef54.firebasestorage.app',
  messagingSenderId: '870679323928',
  appId:             '1:870679323928:web:d3f03a8dddff119951ea6d',
  measurementId:     'G-07L4PSHH9C',
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
