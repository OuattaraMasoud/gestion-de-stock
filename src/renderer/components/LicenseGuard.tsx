import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useLicenseStore } from '../store/useLicenseStore';

interface LicenseGuardProps {
  children: React.ReactNode;
}

export default function LicenseGuard({ children }: LicenseGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isValidated, isChecking, checkLicense } = useLicenseStore();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const verifyLicense = async () => {
      console.log('[LicenseGuard] Début vérification licence...');

      // Timeout de sécurité (5 secondes max)
      const timeoutId = setTimeout(() => {
        console.log('[LicenseGuard] Timeout - forcer hasChecked');
        setHasChecked(true);
      }, 5000);

      try {
        await checkLicense();
        console.log('[LicenseGuard] Vérification terminée');
      } catch (err) {
        console.error('[LicenseGuard] Erreur:', err);
      }

      clearTimeout(timeoutId);
      setHasChecked(true);
    };

    verifyLicense();
  }, []);

  useEffect(() => {
    if (!hasChecked) return;

    // Si on est déjà sur la page d'activation, ne pas rediriger
    if (location.pathname === '/activation') return;

    // Si la licence n'est pas valide, rediriger vers activation
    if (!isValidated && !isChecking) {
      navigate('/activation', { replace: true });
    }
  }, [isValidated, isChecking, hasChecked, location.pathname, navigate]);

  // Afficher un loader pendant la vérification initiale
  if (!hasChecked || isChecking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Vérification de la licence...</p>
        </div>
      </div>
    );
  }

  // Si pas de licence et pas sur la page d'activation, ne rien afficher (redirection en cours)
  if (!isValidated && location.pathname !== '/activation') {
    return null;
  }

  return <>{children}</>;
}
