'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, BadgeCheck, Building2, Wrench } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Those sign-in details did not match an account.');
      setIsSubmitting(false);
      return;
    }

    router.replace('/');
    router.refresh();
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <a className="brand-lockup" href="/login" aria-label="Civicto home">
          <span className="brand-mark"><Building2 size={20} strokeWidth={2.4} /></span>
          <span>Civicto</span>
        </a>
        <div className="auth-story-copy">
          <span className="overline">COMMUNITY OPERATIONS</span>
          <h1>Good places run on work you can trust.</h1>
          <p>One clear place for residents, maintenance teams, and the people coordinating both.</p>
        </div>
        <div className="auth-role-list">
          <div><span className="role-icon"><Building2 size={17} /></span><span>Resident requests</span><BadgeCheck size={16} /></div>
          <div><span className="role-icon"><Wrench size={17} /></span><span>Trade team work</span><BadgeCheck size={16} /></div>
          <div><span className="role-icon"><ArrowRight size={17} /></span><span>Admin oversight</span><BadgeCheck size={16} /></div>
        </div>
        <div className="auth-story-foot"><span>BUILT FOR THE EVERYDAY WORK OF LIVING WELL</span><span>01 / 03</span></div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="mobile-brand brand-lockup">
            <span className="brand-mark"><Building2 size={20} strokeWidth={2.4} /></span>
            <span>Civicto</span>
          </div>
          <span className="overline">WELCOME BACK</span>
          <h2>Sign in to your workspace</h2>
          <p className="auth-subtitle">Use the account created for your role.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>Email address</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@community.com"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </label>
            {error ? <p className="notice error" role="alert">{error}</p> : null}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? 'Signing in' : 'Continue'}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="auth-switch">New resident? <a href="/signup">Create an account</a></p>
          <p className="auth-footnote">Staff accounts are provided by your admin. First admin? Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in .env.</p>
        </div>
        <span className="auth-bottom-line">RESIDENTS · FIELD TEAMS · ADMINISTRATION</span>
      </section>
    </main>
  );
}