import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom"
import { MenuCard } from './Components/MenuCard.tsx'
import { CanteenShop } from './Components/CanteenShop.tsx'
import { Provider, useSelector } from 'react-redux'
import { store } from './Util/store.ts'
import type { RootState } from './Util/store.ts'
import { Cart_Details } from './Components/Cart_Details.tsx'
import ErrorPage from './Components/Error_Page.tsx'
import LoginPage from './Components/LoginPage.tsx'
import MyOrders from './Components/MyOrders.tsx'
import Wrapped from './Components/Wrapped'
import Features from './Components/Features'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { registerServiceWorker } from './Util/pushClient.ts'

/**
 * Reactive auth guard — uses useSelector so it re-renders and redirects
 * as soon as logout() fires, unlike store.getState() which is a snapshot.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useSelector((s: RootState) => s.User.isAuthenticated)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/features",
    element: <Features />,
  },
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/",
        element: <RequireAuth><CanteenShop /></RequireAuth>
      },
      {
        path: "/menu_card_shop/:id",
        element: <RequireAuth><MenuCard /></RequireAuth>
      },
      {
        path: "/cart",
        element: <RequireAuth><Cart_Details /></RequireAuth>
      },
      {
        path: "/orders",
        element: <RequireAuth><MyOrders /></RequireAuth>
      },
      {
        path: "/wrapped",
        element: <RequireAuth><Wrapped /></RequireAuth>
      },
    ]
  }
])

// The service worker only exists in production builds, so dev reloads are not cached
if (import.meta.env.PROD) registerServiceWorker()

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </GoogleOAuthProvider>
  </StrictMode>
)
