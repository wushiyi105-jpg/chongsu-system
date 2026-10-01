import { Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@client/src/contexts/AuthContext';

const AuthGuardContent = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground text-sm">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider>
      <AuthGuardContent>{children}</AuthGuardContent>
    </AuthProvider>
  );
};

export default AuthGuard;
