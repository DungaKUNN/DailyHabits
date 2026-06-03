import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const LOG_PREFIX = '[FirebaseConfig]';

console.log(`${LOG_PREFIX} inicializando Firebase`);

const firebaseConfig = {
  apiKey: "AIzaSyAd-CgrkH0YeTZimKiIFppIeJJH_tDxIyE",
  authDomain: "micomida-gastos.firebaseapp.com",
  projectId: "micomida-gastos",
  storageBucket: "micomida-gastos.firebasestorage.app",
  messagingSenderId: "732637485915",
  appId: "1:732637485915:android:fcd16717ab4700b00ed87e"
};

console.log(`${LOG_PREFIX} initializeApp`);
const app = initializeApp(firebaseConfig);
console.log(`${LOG_PREFIX} getFirestore`);
export const db = getFirestore(app);
console.log(`${LOG_PREFIX} getStorage`);
export const storage = getStorage(app);
console.log(`${LOG_PREFIX} Firebase inicializado correctamente`);
