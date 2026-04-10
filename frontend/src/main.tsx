// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { Toaster } from "react-hot-toast";

// IMPORTANT: import from the folder name that actually exists in your project (you said src/context)
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* AuthProvider wraps the whole app so any useAuth() call works everywhere */}
    <AuthProvider>
      {/* Only one BrowserRouter in the whole app */}
      <BrowserRouter>
        <App />
         <Toaster
    position="top-right"
    toastOptions={{
      duration: 4000,
      style: {
        borderRadius: "12px",
        background: "#1f2937",
        color: "#fff",
        fontSize: "14px",
      },
      success: {
        style: {
          background: "#065f46",
        },
      },
      error: {
        style: {
          background: "#7f1d1d",
        },
      },
    }}
  />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
