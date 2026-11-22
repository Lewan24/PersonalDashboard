import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubProvider } from "./HubContext";
import "./i18n";
import "./styles.css";
import "./dashboard.css";
import App from "./App";
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <HubProvider>
          <App />
        </HubProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
