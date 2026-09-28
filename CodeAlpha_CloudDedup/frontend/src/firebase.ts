
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD2AK0kcHfurnhS2-R7-P6Nd5HXxbljeeA",
  authDomain: "clouddedup-fb33f.firebaseapp.com",
  projectId: "clouddedup-fb33f",
  storageBucket: "clouddedup-fb33f.firebasestorage.app",
  messagingSenderId: "590674816349",
  appId: "1:590674816349:web:4019c6812a215857e48cb4",
  measurementId: "G-CT9VJL6BBT"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);