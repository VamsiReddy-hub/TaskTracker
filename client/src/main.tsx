import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "@/lib/auth";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
