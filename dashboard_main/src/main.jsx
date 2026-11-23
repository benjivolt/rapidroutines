import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from '@/contexts/theme-context'
import { AuthProvider } from '@/contexts/auth-context'
import { ExerciseProvider } from '@/contexts/exercise-context'
import { ChatbotProvider } from '@/contexts/chatbot-context'
import { SavedExercisesProvider } from '@/contexts/saved-exercises-context'
import { RapidTreeProvider } from '@/contexts/rapidtree-context'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SavedExercisesProvider>
          <ExerciseProvider>
            <ChatbotProvider>
              <RapidTreeProvider>
                <App />
              </RapidTreeProvider>
            </ChatbotProvider>
          </ExerciseProvider>
        </SavedExercisesProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)
