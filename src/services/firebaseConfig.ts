import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAd-CgrkH0YeTZimKiIFppIeJJH_tDxIyE",
  authDomain: "micomida-gastos.firebaseapp.com",
  projectId: "micomida-gastos",
  storageBucket: "micomida-gastos.firebasestorage.app",
  messagingSenderId: "732637485915",
  appId: "1:732637485915:android:fcd16717ab4700b00ed87e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
