import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/UiContext'
import { ToastProvider } from './context/UiContext'
import { ProtectedLayout } from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Accounts from './pages/Accounts'
import Channels from './pages/Channels'
import Proxies from './pages/Proxies'
import Queue from './pages/Queue'
import PipelineTimes from './pages/PipelineTimes'
import Violations from './pages/Violations'
import Logs from './pages/Logs'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Overview />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/channels" element={<Channels />} />
                <Route path="/proxies" element={<Proxies />} />
                <Route path="/queue" element={<Queue />} />
                <Route path="/pipeline-times" element={<PipelineTimes />} />
                <Route path="/violations" element={<Violations />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
