import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';

export function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-dark-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">FairPadel V2</h1>
          <Button variant="outline" onClick={handleLogout}>
            Cerrar Sesión
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bienvenido, {user?.nombre} {user?.apellido}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-dark-500">Email:</span>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <span className="text-dark-500">Documento:</span>
                <p className="font-medium">{user?.documento}</p>
              </div>
              <div>
                <span className="text-dark-500">Roles:</span>
                <p className="font-medium">{user?.roles.join(', ')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-dark-500">
          <p>Backend conectado a Railway PostgreSQL ✅</p>
          <p>JWT Authentication funcionando ✅</p>
        </div>
      </div>
    </div>
  );
}
