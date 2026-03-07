import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, MapPin, Users, Award, Calendar, LogOut, Menu, X } from 'lucide-react';

interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  roles: string[];
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Decodificar token básico
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
    } catch {
      localStorage.removeItem('token');
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { path: '/tournaments', label: 'Torneos', icon: Trophy },
    { path: '/sedes', label: 'Sedes', icon: MapPin },
    { path: '/instructores', label: 'Instructores', icon: Users },
    { path: '/rankings', label: 'Rankings', icon: Award },
    { path: '/alquileres', label: 'Alquileres', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white">
      {/* Header */}
      <header className="bg-[#151921] border-b border-[#232838] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <img src="/logos/Asset 2fair padel.png" alt="FairPadel" className="h-8 w-auto" />
              <span className="font-bold text-xl hidden sm:block">FairPadel</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#df2531] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-[#232838]'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              {user && (
                <div className="hidden sm:flex items-center gap-3">
                  <span className="text-sm text-gray-400">
                    {user.nombre} {user.apellido}
                    {user.roles?.includes('admin') && (
                      <span className="ml-2 text-xs bg-[#df2531] px-2 py-0.5 rounded">Admin</span>
                    )}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#232838] rounded-lg transition-colors"
                    title="Cerrar sesión"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-400 hover:text-white"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#232838]">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-[#df2531] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-[#232838]'
                    }`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
              {user && (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#232838] rounded-lg text-sm font-medium"
                >
                  <LogOut size={20} />
                  Cerrar sesión
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
