import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { clearNotificationsOnOpen } from './reminders/push'
import { startOutbox } from './offline/outbox'

clearNotificationsOnOpen()
startOutbox()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
