'use client';

import Link from 'next/link';
import { getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const initialState = {
  title: '',
  category: 'Plumbing',
  location: '',
  urgency: 'MEDIUM',
  description: '',
};

export default function SubmitComplaintPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getSession().then((session) => {
      if (!session) router.replace('/login');
      else if (session.user.role !== 'RESIDENT' && session.user.role !== 'ADMIN') router.replace('/');
    });
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('category', form.category);
      formData.append('location', form.location);
      formData.append('urgency', form.urgency);
      formData.append('description', form.description);
      if (photo) {
        formData.append('photo', photo);
      }

      const response = await fetch('/api/complaints', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Something went wrong');
      }

      setMessage(`Complaint ${payload.complaint.ticketNumber} created successfully.`);
      setForm(initialState);
      setPhoto(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell narrow-shell">
      <div className="topbar">
        <Link href="/" className="back-link">← Back to dashboard</Link>
      </div>

      <section className="panel form-panel">
        <h1>New complaint</h1>
        <p className="subtle-copy">
          Capture the issue, add location details, and send it into the workflow.
        </p>

        <form className="complaint-form" onSubmit={handleSubmit}>
          <div className="field-row two-up">
            <label>
              <span>Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Water leakage in kitchen"
                required
              />
            </label>
            <label>
              <span>Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                <option>Plumbing</option>
                <option>Electrical</option>
                <option>Housekeeping</option>
                <option>Lift-Elevator</option>
                <option>Security</option>
                <option>Civil</option>
                <option>HVAC</option>
              </select>
            </label>
          </div>

          <div className="field-row two-up">
            <label>
              <span>Location</span>
              <input
                type="text"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="Tower B / Flat 402"
                required
              />
            </label>
            <label>
              <span>Urgency</span>
              <select
                value={form.urgency}
                onChange={(event) => setForm({ ...form, urgency: event.target.value })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
          </div>

          <label>
            <span>Description</span>
            <textarea
              rows={5}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Describe the issue clearly, including any visible damage or active problem."
              required
            />
          </label>

          <label>
            <span>Before photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
          </label>

          {error ? <p className="notice error">{error}</p> : null}
          {message ? <p className="notice success">{message}</p> : null}

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Create complaint'}
          </button>
        </form>
      </section>
    </main>
  );
}
