# Relationship Owner daily follow-up WhatsApp digest

## Schedule

- **10:00 AM** every day in **Asia/Kolkata** (IST)
- Uses systemd timer `relationship-owner-follow-up-digest.timer`

## Server setup (not enabled automatically by deploy)

1. Copy env file to `/etc/career-uttsav/relationship-owner-followup.env`:

   ```env
   RELATIONSHIP_OWNER_FOLLOWUP_CRON_SECRET=<strong-secret>
   ```

2. Install unit files from this repo:

   - `deploy/relationship-owner-follow-up-digest.service`
   - `deploy/relationship-owner-follow-up-digest.timer`

3. On the application host, configure Meta template env vars in the Admin app environment:

   - `RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME`
   - `RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_LANGUAGE` (default `en`)

4. Enable when ready:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now relationship-owner-follow-up-digest.timer
   ```

## Endpoint

`POST /api/internal/whatsapp/relationship-owner-follow-ups`

Header: `x-cu-relationship-owner-followup-cron-key`
