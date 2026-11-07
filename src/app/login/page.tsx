import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-dialog';

export const metadata: Metadata = {
  title: 'Sign In | NeuBench AI News',
  description: 'Sign in to NeuBench to access saved AI stories, personalized bookmarks, and community upvotes.',
};

export default function LoginPage() {
  return (
    <main className="auth-page-wrapper">
      <div className="auth-page-card">
        <AuthCard initialMode="signin" isModal={false} />
      </div>
      <nav className="auth-page-footer-nav" aria-label="Auth page navigation">
        <Link href="/home" className="auth-page-footer-link">Home</Link>
        <span>•</span>
        <Link href="/latest" className="auth-page-footer-link">Latest AI News</Link>
        <span>•</span>
        <Link href="/benchmarks" className="auth-page-footer-link">Benchmarks</Link>
        <span>•</span>
        <Link href="/about" className="auth-page-footer-link">About</Link>
      </nav>
    </main>
  );
}
