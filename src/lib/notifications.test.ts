import test from 'node:test';
import assert from 'node:assert/strict';
import { triggerComplaintNotification } from './notifications.ts';

test('assigned notifications use staff contact settings and Resend', async () => {
  const keys = ['STAFF_EMAIL', 'RESIDENT_EMAIL', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  process.env.STAFF_EMAIL = 'staff@example.com';
  process.env.RESIDENT_EMAIL = 'resident@example.com';
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'Civicto <alerts@example.com>';
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response('{}', { status: 200 });
  };

  try {
    const result = await triggerComplaintNotification(
      { id: '1', title: 'Leaking pipe', location: 'Tower A', assignedTeam: 'Plumbing Team' },
      'assigned',
    );

    assert.equal(result.delivered, true);
    assert.equal(result.deliveries[0]?.recipient, 'staff@example.com');
    assert.match(requests[0]?.url ?? '', /api\.resend\.com\/emails/);
    assert.match(String(requests[0]?.init?.body), /Plumbing Team/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test('notifications are reported undelivered when provider settings are absent', async () => {
  const keys = ['STAFF_EMAIL', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];

  try {
    const result = await triggerComplaintNotification(
      { id: '1', title: 'Leaking pipe', location: 'Tower A' },
      'assigned',
    );

    assert.equal(result.delivered, false);
    assert.deepEqual(result.deliveries, []);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test('escalation notifications send SMS to the staff phone through Twilio', async () => {
  const keys = ['STAFF_PHONE', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestBody = '';

  process.env.STAFF_PHONE = '+15551234567';
  process.env.TWILIO_ACCOUNT_SID = 'test-account';
  process.env.TWILIO_AUTH_TOKEN = 'test-token';
  process.env.TWILIO_PHONE = '+15557654321';
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = String(init?.body);
    return new Response('{}', { status: 201 });
  };

  try {
    const result = await triggerComplaintNotification(
      { id: '2', title: 'Lift outage', location: 'Tower A' },
      'escalated',
    );

    assert.equal(result.delivered, true);
    assert.equal(result.deliveries[0]?.channel, 'sms');
    assert.equal(result.deliveries[0]?.recipient, '+15551234567');
    assert.match(requestUrl, /Accounts\/test-account\/Messages\.json/);
    assert.match(requestBody, /To=%2B15551234567/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});