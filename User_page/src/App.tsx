import './App.css'
import { Outlet } from 'react-router-dom'
import { Header } from './Components/Header'
import BiteBotChat from './Components/BiteBotChat'
import { useTheme } from './Util/useTheme'
import { Toaster } from 'react-hot-toast'
import OrderAlerts from './Components/OrderAlerts'

function App() {
  // Initialize theme on app load
  useTheme()

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text-main)' }}
    >
      <Toaster position="top-center" />
      <Header/>
      <main className="pb-20 md:pb-0"><Outlet/></main>
      <BiteBotChat />
      <OrderAlerts />
    </div>
  )
}

export default App
