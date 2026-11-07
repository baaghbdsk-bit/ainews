import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-dialog';

export const metadata: Metadata = {
  title: 'Create Account | NeuBench AI News',
  description: 'Join NeuBench for free: read breaking AI dispatches, benchmark models, save articles, and vote on breakthroughs.',
};

export default function SignupPage() {
  return (
    <main className="auth-page-wrapper">
      <div className="auth-page-card">
        <AuthCard initialMode="signup" isModal={false} />
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
