import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// TODO: Replace the following with your app's Firebase project configuration
// 1. Go to Firebase Console (https://console.firebase.google.com/)
// 2. Open your project, click the Gear icon > Project settings
// 3. Scroll down to "Your apps", select the Web app (</>), and copy the firebaseConfig
const firebaseConfig = {
  apiKey: "AIzaSyA2_FbqyO7Fs5hFsVBs6jT9BBQc--1j2dg",
  authDomain: "chicken-pos-eaa09.firebaseapp.com",
  projectId: "chicken-pos-eaa09",
  storageBucket: "chicken-pos-eaa09.firebasestorage.app",
  messagingSenderId: "844220199222",
  appId: "1:844220199222:web:b9735ee457d0f4ee6a0397",
  measurementId: "G-MS3XLY0SF0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
