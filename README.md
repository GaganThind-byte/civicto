# Civicto

Civicto is a workflow-first complaint management system for hostels, societies, and apartment communities.

## Goals

- Photo-based complaint submission
- Location tagging
- AI classification and routing
- SLA tracking and escalation
- Deduplication and "me too" support
- Notification delivery via SMS / WhatsApp / email
- Audit trail for every complaint lifecycle event

## Architecture at a glance

- Frontend: Next.js + TypeScript
- Database: PostgreSQL + Prisma
- Queue and timers: Redis + BullMQ (or pg-boss for a lighter starter)
- Photo storage: S3 / R2 / Cloudinary
- AI: multimodal LLM for categorization and verification
- Notifications: Resend, Twilio, WhatsApp providers

## Core workflow

SUBMITTED -> TRIAGED -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> VERIFIED -> CLOSED
                              |                 |
                         HUMAN_TRIAGE_QUEUE   REOPENED / ESCALATED

Every transition emits a domain event and is stored in an audit log.

## Quick start

1. Install dependencies: `npm install`
2. Configure `.env` with `DATABASE_URL`, `NEXTAUTH_SECRET`, `INITIAL_ADMIN_EMAIL`, and a strong `INITIAL_ADMIN_PASSWORD`
3. Sync the Prisma schema: `npm run db:push`
4. Start dev server: `npm run dev`

The first configured administrator is created on the first successful sign-in. Sign in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`, then provision residents and maintenance staff from the admin dashboard. Staff accounts are assigned to a team; each role has a separate dashboard and API scope.

## Production integrations

- Photo uploads use `public/uploads` locally. Set `S3_BUCKET` to store them in S3; configure `AWS_REGION` and AWS credentials through the environment or the standard AWS credential chain. For S3-compatible services such as R2 or MinIO, also set `S3_ENDPOINT` and `S3_PUBLIC_URL` to the externally accessible object base URL. Configure the bucket's public-read policy or CDN separately.
- Email uses Resend when `RESIDENT_EMAIL` or `STAFF_EMAIL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` are set.
- SMS uses Twilio when `RESIDENT_PHONE` or `STAFF_PHONE` and the `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE` values are set. Use E.164 phone numbers.
- Submitted and resolved events target resident contact settings. Assigned and escalated events target staff contact settings. Missing provider configuration is reported as undelivered; local development does not send messages.
- SLA automation: configure a hosted cron to send `GET /api/cron/sla` every five minutes with `Authorization: Bearer <CRON_SECRET>`. The endpoint escalates overdue active complaints once and notifies staff; set `CRON_SECRET` before enabling the schedule.

## Project structure

- `src/app` — web app UI
- `src/lib` — workflow logic and triage helpers
- `prisma/schema.prisma` — data model

## Domain model

The key idea is to treat the complaint as a state machine, not just a CRUD record. Each transition tracks who changed it, why, and when.

## Next steps for the real product

1. Build the complaint intake form and photo upload flow
2. Add property / tower / unit hierarchy
3. Implement background AI classification worker
4. Add assignment rules and SLA escalation
5. Add deduplication and "me too" merge logic
6. Add verification step after repair

## Research basis

This project is based on the workflow and schema ideas for hostel / apartment maintenance and resident issue resolution.
