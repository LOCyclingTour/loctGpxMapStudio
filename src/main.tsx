import { StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import App from './App.tsx';
import './index.css';
import { ClerkProvider, Show, RedirectToSignIn } from '@clerk/react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <Show when="signed-in">
        <App />
        <Analytics />
      </Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </ClerkProvider>
  </StrictMode>,
)