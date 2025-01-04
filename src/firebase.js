// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);