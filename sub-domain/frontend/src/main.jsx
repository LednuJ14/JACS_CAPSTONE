import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { PropertyProvider } from './JACS/components/PropertyContext.jsx'

createRoot(document.getElementById("root")).render(
  <PropertyProvider>
    <App />
  </PropertyProvider>
);
