
# BytSave Email System Documentation

## Current Email Flow Overview

```
Admin UI → API Routes → Email Service → SendGrid → User Inbox
   ↓           ↓            ↓            ↓         ↓
Template   Validation   Rendering    Sending   Logging
Selection  & Auth       & Styling    & API     to DB
```

## Step-by-Step Flow

### 1. Admin Email Test UI (`client/src/pages/admin-email-test.tsx`)
- **Purpose**: Admin interface for testing email templates
- **Entry Point**: Admin navigates to `/admin/email-test`
- **Dependencies**: 
  - Admin auth token from `AdminAuth.getToken()`
  - React Query for template loading
- **User Actions**:
  - Select template from dropdown (loaded via `getEmailTemplates()`)
  - Click "Preview" to see rendered template
  - Enter test email address
  - Click "Send & Verify Email" to send test

### 2. Admin Email Routes (`server/routes/adminEmail.ts`)
- **Purpose**: API endpoints for email management
- **Authentication**: Uses `requireAdmin` middleware with token validation
- **Key Routes**:
  - `GET /api/admin/email-templates` → Returns available templates
  - `GET /api/admin/email/preview/:id` → Renders template for preview
  - `POST /api/admin/send-test-email` → Sends actual test email

### 3. Email Templates (`server/email/templates.ts`)
- **Purpose**: Template engine for email content
- **Templates Available**:
  - `price-drop`: Product price alerts
  - `welcome`: New user onboarding  
  - `password-reset`: Password reset links
  - `magic-link`: Passwordless login
  - `promo`: Marketing campaigns
- **Functions**:
  - `listTemplates()`: Returns template metadata for UI
  - `renderTemplate(id, data)`: Renders HTML + subject with dynamic data

### 4. Email Service (`server/emailService.ts`)
- **Purpose**: High-level email orchestration
- **Responsibilities**:
  - Template rendering coordination
  - Database logging for all sends
  - Affiliate link injection for Amazon URLs
- **Key Functions**:
  - `sendEmail(options)`: Generic email sender
  - `sendPriceDropAlert()`: Automated price alerts
  - `sendPasswordResetEmail()`: Auth flow emails

### 5. SendGrid Service (`server/email/sendgridService.ts`)
- **Purpose**: Low-level SendGrid API integration
- **Environment Variables Required**:
  - `SENDGRID_API_KEY`: API key from Replit Secrets
  - `EMAIL_FROM`: Sender address (defaults to alerts@bytsave.com)
- **Returns**: `{ success: boolean, messageId?: string, error?: string }`

## Environment Variables

### Required
- `SENDGRID_API_KEY`: SendGrid API key (stored in Replit Secrets)

### Optional
- `EMAIL_FROM`: Sender email address (defaults to alerts@bytsave.com)
- `ADMIN_SECRET`: Admin authentication token

## Current Limitations & TODOs

### Database Logging
- ✅ Basic email logging to `email_logs` table
- ❌ No webhook handling for delivery status
- ❌ No bounce/unsubscribe tracking

### Template System
- ✅ Static HTML templates with variable replacement
- ❌ No template versioning or A/B testing
- ❌ No visual template editor

### Deliverability
- ✅ Basic SendGrid integration
- ❌ No branded domain setup
- ❌ No delivery optimization

### Admin Features
- ✅ Template preview and test sending
- ❌ No bulk email capabilities
- ❌ No email scheduling
- ❌ No delivery analytics dashboard

## Database Schema

### `email_logs` Table
```sql
CREATE TABLE email_logs (
  id SERIAL PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  product_id INTEGER REFERENCES products(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subject TEXT,
  preview_html TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing The System

### 1. Manual Test via Admin UI
1. Navigate to `/admin/email-test`
2. Enter admin credentials
3. Select a template (e.g., "Password Reset")
4. Click "Preview" to see rendered HTML
5. Enter your email address
6. Click "Send & Verify Email"
7. Check your inbox for test email with [TEST] prefix

### 2. Direct API Test
```bash
# Test template loading
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  http://localhost:5000/api/admin/email-templates

# Test preview
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  http://localhost:5000/api/admin/email/preview/password-reset

# Test send
curl -X POST -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"email":"test@example.com","templateId":"password-reset"}' \
  http://localhost:5000/api/admin/send-test-email
```

## Future Enhancements

### Phase 1: Logging & Webhooks
- Add SendGrid webhook endpoint for delivery status
- Enhance email_logs with delivery_status, opened_at, clicked_at
- Add email analytics dashboard

### Phase 2: User Features  
- User email preferences (frequency, types)
- Unsubscribe link handling
- Email verification workflow

### Phase 3: Advanced Features
- Template versioning and A/B testing
- Bulk email campaigns
- Email scheduling
- Advanced segmentation

## File Dependencies

```
client/src/pages/admin-email-test.tsx
├── AdminAuth.getToken() → Admin authentication
├── /api/admin/email-templates → server/routes/adminEmail.ts
├── /api/admin/email/preview/:id → server/routes/adminEmail.ts
└── /api/admin/send-test-email → server/routes/adminEmail.ts

server/routes/adminEmail.ts
├── requireAdmin → server/middleware/requireAdmin.ts
├── listTemplates() → server/email/templates.ts
├── renderTemplate() → server/email/templates.ts
└── sendEmail() → server/emailService.ts

server/emailService.ts
├── sendEmail() → server/email/sendgridService.ts
├── renderTemplate() → server/email/templates.ts
├── db.insert(emailLogs) → Database logging
└── addAffiliateTag() → server/utils/affiliateLinks.ts

server/email/sendgridService.ts
├── process.env.SENDGRID_API_KEY → Replit Secrets
├── process.env.EMAIL_FROM → Environment variable
└── sgMail.send() → SendGrid API
```
