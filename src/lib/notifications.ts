export type NotificationEvent = 'submitted' | 'assigned' | 'resolved' | 'escalated';

export type ComplaintForNotification = {
  id: string;
  ticketNumber?: string;
  title: string;
  location: string;
  category?: string;
  assignedTeam?: string;
  urgency?: string;
  status?: string;
};

export type NotificationDelivery = {
  channel: 'email' | 'sms';
  recipient: string;
  delivered: boolean;
  error?: string;
};

export type NotificationResult = {
  delivered: boolean;
  message: string;
  deliveries: NotificationDelivery[];
};

export async function triggerComplaintNotification(
  complaint: ComplaintForNotification,
  event: NotificationEvent,
): Promise<NotificationResult> {
  const eventLabels: Record<NotificationEvent, string> = {
    submitted: 'submitted',
    assigned: 'assigned to the maintenance team',
    resolved: 'resolved',
    escalated: 'escalated for priority review',
  };

  const targetIsStaff = event === 'assigned' || event === 'escalated';
  const recipientEmail = targetIsStaff ? process.env.STAFF_EMAIL : process.env.RESIDENT_EMAIL;
  const recipientPhone = targetIsStaff ? process.env.STAFF_PHONE : process.env.RESIDENT_PHONE;
  const teamMessage = complaint.assignedTeam ? ` Team: ${complaint.assignedTeam}.` : '';
  const message = `Complaint ${complaint.ticketNumber ?? complaint.id} for ${complaint.title} at ${complaint.location} has been ${eventLabels[event]}.${teamMessage}`;
  const deliveries: NotificationDelivery[] = [];

  if (recipientEmail) {
    deliveries.push(await sendEmail(recipientEmail, complaint, event, message));
  }

  if (recipientPhone) {
    deliveries.push(await sendSms(recipientPhone, message));
  }

  return { delivered: deliveries.some((delivery) => delivery.delivered), message, deliveries };
}

async function sendEmail(
  recipient: string,
  complaint: ComplaintForNotification,
  event: NotificationEvent,
  message: string,
): Promise<NotificationDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { channel: 'email', recipient, delivered: false, error: 'Resend credentials or sender are not configured.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `Civicto complaint ${complaint.ticketNumber ?? complaint.id}: ${event}`,
        text: message,
      }),
    });
    return response.ok
      ? { channel: 'email', recipient, delivered: true }
      : { channel: 'email', recipient, delivered: false, error: `Resend returned HTTP ${response.status}.` };
  } catch {
    return { channel: 'email', recipient, delivered: false, error: 'Resend request failed.' };
  }
}

async function sendSms(recipient: string, message: string): Promise<NotificationDelivery> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE;
  if (!accountSid || !authToken || !from) {
    return { channel: 'sms', recipient, delivered: false, error: 'Twilio credentials or sender are not configured.' };
  }

  try {
    const body = new URLSearchParams({ To: recipient, From: from, Body: message });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    return response.ok
      ? { channel: 'sms', recipient, delivered: true }
      : { channel: 'sms', recipient, delivered: false, error: `Twilio returned HTTP ${response.status}.` };
  } catch {
    return { channel: 'sms', recipient, delivered: false, error: 'Twilio request failed.' };
  }
}
