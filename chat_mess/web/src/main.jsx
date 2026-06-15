import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import Aurora from "./components/Aurora.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { LightboxProvider } from "./context/LightboxContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Aurora />
      <ToastProvider>
        <LightboxProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LightboxProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
