import { Compass } from 'lucide-react';
import { Button, EmptyState } from '../components/ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/misc.js';

/** Friendly 404 instead of a blank screen (SB1/US42). */
export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { isAuthenticated } = useAuth();
  return (
    <main id="main" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--space-6)' }}>
      <div style={{ maxWidth: 520, width: '100%' }}>
        <EmptyState
          icon={Compass}
          title="We couldn’t find that page"
          description="The link may be broken or the page may have moved."
          action={
            <Button to={isAuthenticated ? '/dashboard' : '/'}>
              {isAuthenticated ? 'Go to your dashboard' : 'Go to the home page'}
            </Button>
          }
        />
      </div>
    </main>
  );
}
