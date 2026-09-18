import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './print.css'

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} else {
  console.error("Critical Error: Root element not found in HTML.");
}
