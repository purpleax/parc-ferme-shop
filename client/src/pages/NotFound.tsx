import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      body="The page you're looking for has been moved, retired, or never existed."
      action={
        <Link to="/" className="rounded-full bg-snow px-6 py-2.5 text-sm font-medium text-carbon transition hover:bg-accent">
          Back home
        </Link>
      }
    />
  );
}
