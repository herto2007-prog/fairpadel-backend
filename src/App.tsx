import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';

// Auth
import LoginPage from './features/auth/pages/LoginPage';

// Torneos (V1)
import TournamentsListPage from './features/tournaments/pages/TournamentsListPage';
import TournamentDetailPage from './features/tournaments/pages/TournamentDetailPage';

// Inscripciones (V1)
import MisInscripcionesPage from './features/inscripciones/pages/MisInscripcionesPage';

// Rankings (V1)
import RankingsPage from './features/rankings/pages/RankingsPage';

// Sedes (V2)
import SedesListPage from './features/sedes/pages/SedesListPage';
import SedeDetailPage from './features/sedes/pages/SedeDetailPage';

// Alquileres (V2)
import AlquileresPage from './features/alquileres/pages/AlquileresPage';
import MisReservasPage from './features/alquileres/pages/MisReservasPage';

// Instructores (V2)
import InstructoresListPage from './features/instructores/pages/InstructoresListPage';
import InstructorDetailPage from './features/instructores/pages/InstructorDetailPage';

// Layout wrapper para rutas protegidas
function ProtectedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing - Pública */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Rutas Protegidas con Layout */}
        <Route element={<ProtectedLayout />}>
          {/* Dashboard */}
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* Torneos (V1) */}
          <Route path="/tournaments" element={<TournamentsListPage />} />
          <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          
          {/* Inscripciones (V1) */}
          <Route path="/inscripciones/my" element={<MisInscripcionesPage />} />
          
          {/* Rankings (V1) */}
          <Route path="/rankings" element={<RankingsPage />} />
          
          {/* Sedes (V2) */}
          <Route path="/sedes" element={<SedesListPage />} />
          <Route path="/sedes/:id" element={<SedeDetailPage />} />
          
          {/* Alquileres (V2) */}
          <Route path="/alquileres" element={<AlquileresPage />} />
          <Route path="/mis-reservas" element={<MisReservasPage />} />
          
          {/* Instructores (V2) */}
          <Route path="/instructores" element={<InstructoresListPage />} />
          <Route path="/instructores/:id" element={<InstructorDetailPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
