import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from './context/LanguageContext.tsx';
import './index.css';

// "/"  → the public website for visitors
// "/admin" → the admin panel (separate code, only downloaded by people who open it)
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
const Root = lazy(() => (isAdminRoute ? import('./App.tsx') : import('./PublicSite.tsx')));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#0F0F0F]" />}>
        <Root />
      </Suspense>
    </LanguageProvider>
  </StrictMode>,
);
