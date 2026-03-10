import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const V2App = lazy(() => import('./v2/V2App.tsx'))

const useV2 = new URLSearchParams(window.location.search).has('v2')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {useV2 ? (
      <Suspense fallback={<div style={{ background: '#0a0a0f', minHeight: '100vh' }} />}>
        <V2App />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
