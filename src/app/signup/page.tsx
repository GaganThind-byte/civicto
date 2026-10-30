'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Building2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to create account.');

      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) throw new Error('Account created. Sign in with your new credentials.');

      router.replace('/resident');
      router.refresh();
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'Unable to create account.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <a className="brand-lockup" href="/signup" aria-label="Civicto home">
          <span className="brand-mark"><Building2 size={20} strokeWidth={2.4} /></span>
          <span>Civicto</span>
        </a>
        <div className="auth-story-copy">
          <span className="overline">YOUR COMMUNITY, CONNECTED</span>
          <h1>A better way to get the little things fixed.</h1>
          <p>Keep track of service requests from the first photo to the final repair.</p>
        </div>
        <div className="auth-story-foot"><span>RESIDENT ACCESS</span><span>02 / 03</span></div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="mobile-brand brand-lockup">
            <span className="brand-mark"><Building2 size={20} strokeWidth={2.4} /></span>
            <span>Civicto</span>
          </div>
          <span className="overline">RESIDENT ACCOUNT</span>
          <h2>Create your account</h2>
          <p className="auth-subtitle">Register to submit requests and follow repair progress.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>Full name</span>
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required />
            </label>
            <label>
              <span>Email address</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@community.com" required />
            </label>
            <label>
              <span>Password <small>(12 characters minimum)</small></span>
              <input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" required />
            </label>
            {error ? <p className="notice error" role="alert">{error}</p> : null}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? 'Creating account' : 'Create resident account'}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="auth-footnote">Maintenance staff and admins are invited by a community administrator.</p>
          <p className="auth-switch">Already registered? <Link href="/login">Sign in</Link></p>
        </div>
        <span className="auth-bottom-line">RESIDENTS · FIELD TEAMS · ADMINISTRATION</span>
      </section>
    </main>
  );
}