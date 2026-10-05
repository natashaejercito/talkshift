import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { RequireAuth } from './auth/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { Auth0Provider } from '@auth0/auth0-react'
import { RoleHome } from './pages/RoleHome'
import { StaffLayout } from './layouts/StaffLayout'
import { SchedulePage } from './pages/staff/SchedulePage'
import { AvailabilityPage } from './pages/staff/AvailabilityPage'
import { RequestsPage } from './pages/staff/RequestsPage'
import { RequireManager } from './auth/RequireManager'
import { ManagerLayout } from './layouts/ManagerLayout'
import { ManagerSchedulePage } from './pages/manager/ManagerSchedulePage'
import { StaffPage } from './pages/manager/StaffPage'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      }}
      useRefreshTokens
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<RequireAuth />}>
    <Route path="/" element={<RoleHome />} />

    <Route element={<StaffLayout />}>
      <Route path="/schedule" element={<SchedulePage />} />
      <Route path="/availability" element={<AvailabilityPage />} />
      <Route path="/requests" element={<RequestsPage />} />
    </Route>

    <Route element={<RequireManager />}>
      <Route element={<ManagerLayout />}>
        <Route path="/manager/schedule" element={<ManagerSchedulePage />} />
        <Route path="/manager/staff" element={<StaffPage />} />
      </Route>
    </Route>
  </Route>
</Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </Auth0Provider>
  </StrictMode>,
)