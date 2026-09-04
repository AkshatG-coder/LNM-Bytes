import './App.css'
import { Outlet } from 'react-router-dom'
import { Header } from './Components/Header'
import { useTheme } from './Util/useTheme'
import { Toaster } from 'react-hot-toast'

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
      <Outlet/>
    </div>
  )
}

export default App
