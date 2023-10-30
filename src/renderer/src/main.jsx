import 'halfmoon/css/halfmoon.min.css';
import './assets/index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
);
