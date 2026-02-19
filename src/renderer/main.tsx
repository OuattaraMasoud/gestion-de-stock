import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { useThemeStore } from './store/useThemeStore';

// Apply saved theme before first render to avoid flash
useThemeStore.getState().applyTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
