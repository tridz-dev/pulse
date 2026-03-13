import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { MyTasks } from './pages/MyTasks';
import { Team } from './pages/Team';
import { Operations } from './pages/Operations';
import { Templates } from './pages/Templates';
import { Insights } from './pages/Insights';
import { UserProfile } from './pages/UserProfile';

export default function App() {
  return (
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
            <Route path="insights" element={<Insights />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
