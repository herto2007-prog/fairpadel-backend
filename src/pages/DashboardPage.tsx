import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Calendar, Users, MapPin, ChevronRight, Bell } from 'lucide-react';

interface User {
  nombre: string;
  apellido: string;
  roles: string[];
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch {
        console.error('Error decoding token');
      }
    }
  }, []);

  const quickActions = [
    {
      title: 'Torneos',
      description: 'Ver torneos disponibles y mis inscripciones',
      icon: Trophy,
      href: '/tournaments',
      color: 'bg-blue-500/20 text-blue-400',
    },
    {
      title: 'Sedes',
      description: 'Explorar sedes y reservar canchas',
      icon: MapPin,
      href: '/sedes',
      color: 'bg-green-500/20 text-green-400',
    },
    {
      title: 'Instructores',
      description: 'Reservar clases con instructores',
      icon: Users,
      href: '/instructores',
      color: 'bg-purple-500/20 text-purple-400',
    },
    {
      title: 'Rankings',
      description: 'Ver rankings y estadísticas',
      icon: Trophy,
      href: '/rankings',
      color: 'bg-yellow-500/20 text-yellow-400',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            ¡Hola, {user?.nombre || 'Usuario'}! 👋
          </h1>
          <p className="text-gray-400">
            {user?.roles?.includes('admin') 
              ? 'Panel de Administrador' 
              : 'Bienvenido a FairPadel'}
          </p>
        </div>

        {/* Accesos Rápidos */}
        <h2 className="text-xl font-semibold mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                to={action.href}
                className="bg-[#151921] border border-[#232838] rounded-lg p-6 hover:border-[#df2531] transition-colors group"
              >
                <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-4`}>
                  <Icon size={24} />
                </div>
                <h3 className="font-semibold mb-1 group-hover:text-[#df2531] transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-400">{action.description}</p>
                <div className="flex items-center gap-1 mt-4 text-[#df2531] text-sm font-medium">
                  Ver más
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Contenido Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mis Próximos Torneos */}
          <div className="lg:col-span-2 bg-[#151921] border border-[#232838] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trophy size={20} className="text-[#df2531]" />
                Mis Próximos Torneos
              </h2>
              <Link to="/tournaments" className="text-sm text-[#df2531] hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="text-gray-400 text-center py-8">
              No tienes torneos próximos
              <div className="mt-4">
                <Link 
                  to="/tournaments" 
                  className="inline-block px-4 py-2 bg-[#df2531] rounded-lg text-white text-sm hover:bg-red-700 transition-colors"
                >
                  Explorar Torneos
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Mis Reservas */}
            <div className="bg-[#151921] border border-[#232838] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar size={20} className="text-[#df2531]" />
                  Mis Reservas
                </h2>
                <Link to="/mis-reservas" className="text-sm text-[#df2531] hover:underline">
                  Ver
                </Link>
              </div>
              <div className="text-gray-400 text-sm text-center py-4">
                No tienes reservas pendientes
              </div>
              <Link 
                to="/alquileres" 
                className="block w-full text-center py-2 bg-[#232838] rounded-lg text-sm hover:bg-[#2d3548] transition-colors"
              >
                Reservar Cancha
              </Link>
            </div>

            {/* Notificaciones */}
            <div className="bg-[#151921] border border-[#232838] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={20} className="text-[#df2531]" />
                <h2 className="text-lg font-semibold">Notificaciones</h2>
              </div>
              <div className="text-gray-400 text-sm text-center py-4">
                No tienes notificaciones nuevas
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
