import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ThemeProvider } from './store/ThemeContext';
import { ToastProvider } from './store/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { MyTasks } from './pages/MyTasks';
import { Team } from './pages/Team';
import { Operations } from './pages/Operations';
import { Templates } from './pages/Templates';
import { Insights } from './pages/Insights';
import { CorrectiveActions } from './pages/CorrectiveActions';
import { UserProfile } from './pages/UserProfile';
import { DesignGallery } from './pages/DesignGallery';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter basename="/pulse">
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="tasks" element={<MyTasks />} />
                <Route path="team" element={<Team />} />
                <Route path="operations" element={<Operations />} />
                <Route path="operations/:userId" element={<UserProfile />} />
                <Route path="templates" element={<Templates />} />
                <Route path="corrective-actions" element={<CorrectiveActions />} />
                <Route path="insights" element={<Insights />} />
              </Route>
              <Route path="/__design" element={<DesignGallery />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
