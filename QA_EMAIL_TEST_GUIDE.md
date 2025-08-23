
# Email Alert System - QA Test Flow

## Overview
This guide provides step-by-step instructions for testing the end-to-end email alert system.

## Prerequisites
- Server running locally
- Admin token (`ADMIN_SECRET` environment variable)
- Alert trigger token (`ALERT_TRIGGER_TOKEN` environment variable)
- Valid tracked product in database (ID 42 recommended for testing)

## Test Flow

### Step 1: Setup Price Drop Scenario
```bash
# Replace YOUR_ADMIN_SECRET with your actual ADMIN_SECRET value
GET /api/dev/drop-price/42?token=YOUR_ADMIN_SECRET
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Price drop simulation configured successfully",
  "data": {
    "trackedProductId": 42,
    "productTitle": "Product Name",
    "asin": "B01EXAMPLE",
    "currentPrice": 25.99,
    "oldTargetPrice": 30.00,
    "newTargetPrice": 35.99,
    "email": "user@example.com",
    "notified": false
  },
  "nextStep": "Call GET /api/run-daily-alerts?token=YOUR_ALERT_TRIGGER_TOKEN to trigger alerts"
}
```

**Expected Console Logs:**
```
QA TEST: Updated tracked product 42
  - Product: Example Product (ASIN: B01EXAMPLE)
  - Current Price: $25.99
  - Target Price: $30.00 → $35.99
  - Notified: true → false
```

### Step 2: Trigger Daily Alerts
```bash
# Replace YOUR_ALERT_TRIGGER_TOKEN with your actual ALERT_TRIGGER_TOKEN value
GET /api/run-daily-alerts?token=YOUR_ALERT_TRIGGER_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Daily alerts job completed successfully",
  "alertsProcessed": 1,
  "timestamp": "2025-01-23T22:30:00.000Z",
  "duration": "1234ms"
}
```

**Expected Console Logs:**
```
🔔 Manual daily alerts job triggered via API
📊 Checking for price drop alerts...
🔍 Found 1 tracked products to check for alerts
📋 Checking product B01EXAMPLE:
   Title: Example Product
   Current Price: $25.99
   Target Price: $35.99
   Already Notified: false
   Should Alert: true
🚨 Preparing to send alert for product B01EXAMPLE to user@example.com
✅ Successfully sent price drop alert to user@example.com for Example Product
📊 Processing complete: 1 alerts sent out of 1 tracked products
✅ Daily alerts job completed in 1234ms
📧 Total alerts processed: 1
```

### Step 3: Verify Email Delivery
Check the recipient's email inbox for:
- Subject: "🎯 Price Drop Alert - [Product Title]"
- Email content with current price, target price, and product details
- Affiliate link to Amazon product

### Step 4: Verify Database State
After successful alert:
- `tracked_products.notified` should be `true` for the test record
- `email_logs` table should have a new entry

## Testing Different Scenarios

### Test No Alert Needed
```bash
# Run the same commands again - should show no alerts
GET /api/run-daily-alerts?token=YOUR_ALERT_TRIGGER_TOKEN
```
Expected: `alertsProcessed: 0` because `notified` is now `true`

### Test Multiple Products
```bash
# Setup multiple products
GET /api/dev/drop-price/43?token=YOUR_ADMIN_SECRET
GET /api/dev/drop-price/44?token=YOUR_ADMIN_SECRET

# Trigger alerts
GET /api/run-daily-alerts?token=YOUR_ALERT_TRIGGER_TOKEN
```

## Troubleshooting

### No Alerts Sent
1. Check if `notified` field is already `true`
2. Verify `currentPrice` vs `targetPrice` logic
3. Check SendGrid API key configuration
4. Review console logs for error messages

### Email Not Received
1. Check spam/junk folder
2. Verify SendGrid dashboard for delivery status
3. Check `email_logs` table for sent status
4. Verify recipient email address

### Database Errors
1. Ensure tracked product exists with valid product relationship
2. Check database connection
3. Verify schema is up to date

## Environment Variables Required
```
ADMIN_SECRET=your_admin_secret_here
ALERT_TRIGGER_TOKEN=your_alert_trigger_token_here
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=noreply@yourdomain.com
```
