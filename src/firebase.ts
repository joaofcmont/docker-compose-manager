// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBWNkLTxcq8iwri5YW4SXqJHyeTa0jHhPA",
  authDomain: "docker-compose-manager-db558.firebaseapp.com",
  projectId: "docker-compose-manager-db558",
  storageBucket: "docker-compose-manager-db558.firebasestorage.app",
  messagingSenderId: "782140049884",
  appId: "1:782140049884:web:25e18b9d591d2eeafce719",
  measurementId: "G-GL75JRK1GF"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const analytics: Analytics = getAnalytics(app);
const db: Firestore = getFirestore(app);

// Export for use in Angular services
export { app, analytics, db };

