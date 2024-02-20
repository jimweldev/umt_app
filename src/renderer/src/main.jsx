import React from 'react'

// libraries
import { ToastContainer } from 'react-toastify'

// CSS & JS
import 'bootstrap/dist/css/bootstrap.min.css'
import '@adminkit/core/dist/css/app.css'
import 'bootstrap/dist/js/bootstrap.min.js'
import 'react-toastify/dist/ReactToastify.css'
import './assets/index.css'

// others
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <ToastContainer closeOnClick={false} autoClose={3000} />
  </React.StrictMode>
)
