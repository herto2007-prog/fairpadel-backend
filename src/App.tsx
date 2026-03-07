import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Landing
import LandingPage from './pages/LandingPage';

// Auth
import LoginPage from './features/auth/pages/LoginPage';

// Torneos (V1)
import TournamentsListPage from './features/tournaments/pages/TournamentsListPage';
import TournamentDetailPage from './features/tournaments/pages/TournamentDetailPage';

// Inscripciones (V1)
import MisInscripcionesPage from './features/inscripciones/pages/MisInscripcionesPage';

// Fixture (V1)
// import BracketPage from './features/fixture/pages/BracketPage';

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

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Torneos (V1) */}
        <Route path="/tournaments" element={<TournamentsListPage />} />
        <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
        
        {/* Inscripciones (V1) */}
        <Route path="/inscripciones/my" element={<MisInscripcionesPage />} />
        {/* <Route path="/inscripciones/tournament/:id" element={<InscripcionPage />} /> */}
        
        {/* Fixture (V1) */}
        {/* <Route path="/fixture/:tournamentId/:categoryId" element={<BracketPage />} /> */}
        
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
      </Routes>
    </Router>
  );
}

export default App;
