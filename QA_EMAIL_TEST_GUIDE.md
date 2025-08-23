
<old_str>
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
</old_str>
<new_str># Email Alert System - QA Test Guide

## Overview
This comprehensive guide provides step-by-step instructions for testing the end-to-end email alert system with detailed logging and verification steps.

## Prerequisites
- Server running with environment variables configured
- Admin token (`ADMIN_SECRET` environment variable)
- Alert trigger token (`ALERT_TRIGGER_TOKEN` environment variable)  
- SendGrid API key configured (`SENDGRID_API_KEY`)
- Valid tracked product in database (any ID will work)

## Test Flow

### Step 1: Setup Price Drop Scenario
Configure a tracked product to trigger an alert by setting its target price above the current price.

```bash
# Replace YOUR_ADMIN_SECRET and 42 with actual values
GET /api/dev/drop-price/42?token=YOUR_ADMIN_SECRET
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Price drop simulation configured successfully",
  "data": {
    "trackedProductId": 42,
    "productTitle": "Example Product Name",
    "asin": "B01EXAMPLE123",
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
🧪 QA TEST: Updated tracked product 42
  📦 Product: Example Product (ASIN: B01EXAMPLE123)
  💰 Current Price: $25.99
  🎯 Target Price: $30.00 → $35.99
  🔔 Notified: true → false
  📧 Email: user@example.com
```

### Step 2: Trigger Daily Alerts Job
Execute the daily alerts process to check for price drops and send notifications.

```bash
# Replace YOUR_ALERT_TRIGGER_TOKEN with actual token
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

**Expected Detailed Console Logs:**
```
🔔 QA: Starting price alerts processing...
🔍 QA: Found 1 tracked products to check for alerts

📋 QA: [1/1] Processing tracked product ID 42
   📦 Product: Example Product Name
   🔗 ASIN: B01EXAMPLE123
   💰 Current Price: $25.99
   🎯 Target Price: $35.99
   📧 Email: user@example.com
   🔔 Already Notified: false

🔍 QA: Checking alert criteria for tracked product ID 42
💰 QA: Fixed Price Alert Check:
   - Current Price: $25.99
   - Target Price: $35.99
   - Price <= Target: true
   - Should Alert: true

🚨 QA: ALERT TRIGGERED! Preparing to send email alert
   📧 Recipient: user@example.com
   📦 Product: Example Product Name (B01EXAMPLE123)

📤 QA: Calling sendPriceDropAlert...
✅ QA: EMAIL SENT SUCCESSFULLY!
   📧 To: user@example.com
   📦 Product: Example Product Name

🔄 QA: Updating notified flag to true...
✅ QA: Notified flag updated successfully

📊 QA: Processing complete!
   ✅ Alerts sent: 1
   📋 Total products checked: 1
   📈 Success rate: 100.0%
```

### Step 3: Verify Email Delivery
Check the recipient's email inbox for the price drop alert:

**Expected Email Content:**
- **Subject**: "🎯 Price Drop Alert - [Product Title]"
- **Body**: Professional HTML template with:
  - Product title and image
  - Current price vs target price
  - "View Deal" button with affiliate link
  - Unsubscribe option

### Step 4: Verify Database State
Confirm that the system properly updated the tracking record:

1. **tracked_products table**: `notified` field should now be `true`
2. **email_logs table**: New entry with email details and timestamp

### Step 5: Test No Duplicate Alerts
Run the alerts job again to verify no duplicate emails are sent:

```bash
GET /api/run-daily-alerts?token=YOUR_ALERT_TRIGGER_TOKEN
```

**Expected Response:** `alertsProcessed: 0`

**Expected Console Logs:**
```
⏭️  QA: Skipping - already notified (notified=true)
⏭️  QA: No alert needed - conditions not met
```

## Advanced Testing Scenarios

### Test Multiple Products
```bash
# Setup multiple products for testing
GET /api/dev/drop-price/43?token=YOUR_ADMIN_SECRET
GET /api/dev/drop-price/44?token=YOUR_ADMIN_SECRET
GET /api/dev/drop-price/45?token=YOUR_ADMIN_SECRET

# Trigger alerts for all
GET /api/run-daily-alerts?token=YOUR_ALERT_TRIGGER_TOKEN
```

### Test Percentage-Based Alerts
If you have products with `percentageAlert=true`:
1. The logs will show percentage calculations
2. Look for "Percentage Alert Check" in console output
3. Verify discount percentage vs threshold comparison

### Test Error Scenarios
- **Invalid Product ID**: `GET /api/dev/drop-price/99999?token=YOUR_ADMIN_SECRET`
- **Invalid Token**: `GET /api/dev/drop-price/42?token=invalid`
- **Missing Product**: Products without associated product records

## Troubleshooting Guide

### No Alerts Sent
**Check Console Logs For:**
- `⏭️ QA: Skipping - already notified` (already sent)
- `Price <= Target: false` (price condition not met)
- `❌ QA: EMAIL SEND FAILED!` (SendGrid issues)

**Common Issues:**
1. `notified` field already `true` - reset with Step 1
2. Current price higher than target price - adjust with Step 1
3. SendGrid API key missing or invalid
4. Network connectivity issues

### Email Not Received
**Verification Steps:**
1. Check spam/junk folder
2. Verify SendGrid dashboard for delivery status
3. Check `email_logs` table for sent confirmation
4. Confirm recipient email address is correct
5. Test with a different email address

### Database Connection Issues
**Check For:**
- Database connection string
- Table schema compatibility
- Foreign key relationships
- Tracked product exists and has valid product reference

### SendGrid Integration Issues
**Verify:**
- `SENDGRID_API_KEY` environment variable set
- API key has email sending permissions
- `EMAIL_FROM` address is verified in SendGrid
- No rate limiting or quota exceeded

## Environment Variables Checklist
```bash
# Required for QA testing
ADMIN_SECRET=your_admin_secret_token
ALERT_TRIGGER_TOKEN=your_alert_trigger_token
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=verified@yourdomain.com

# Optional for enhanced testing
TEST_ADMIN_EMAIL=admin@yourdomain.com
```

## Success Criteria
A successful QA test should show:
1. ✅ Price drop endpoint configures test properly
2. ✅ Alert conditions detected correctly 
3. ✅ Email sent successfully via SendGrid
4. ✅ Database updated with `notified=true`
5. ✅ No duplicate emails on subsequent runs
6. ✅ Detailed logs throughout the process

## Quick Test Commands
For rapid testing, use these commands in sequence:

```bash
# 1. Setup test
curl "http://localhost:5000/api/dev/drop-price/42?token=YOUR_ADMIN_SECRET"

# 2. Trigger alerts  
curl "http://localhost:5000/api/run-daily-alerts?token=YOUR_ALERT_TRIGGER_TOKEN"

# 3. Check no duplicates
curl "http://localhost:5000/api/run-daily-alerts?token=YOUR_ALERT_TRIGGER_TOKEN"
```

Replace `localhost:5000` with your actual server URL and update the tokens accordingly.</new_str>
