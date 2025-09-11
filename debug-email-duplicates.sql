
-- Query to find duplicate email logs by SendGrid message ID
SELECT 
  sg_message_id, 
  COUNT(*) as count,
  STRING_AGG(CAST(id AS TEXT), ', ') as log_ids,
  STRING_AGG(status, ', ') as statuses,
  MIN(sent_at) as first_sent,
  MAX(sent_at) as last_sent
FROM email_logs 
GROUP BY sg_message_id 
HAVING COUNT(*) > 1 
ORDER BY count DESC, last_sent DESC;

-- Query to find logs with null or fallback message IDs
SELECT 
  id,
  recipient_email,
  subject,
  sg_message_id,
  status,
  sent_at
FROM email_logs 
WHERE sg_message_id IS NULL 
   OR sg_message_id LIKE 'fallback-%'
   OR sg_message_id LIKE 'failed-%'
ORDER BY sent_at DESC
LIMIT 20;

-- Quick stats
SELECT 
  'Total Logs' as metric,
  COUNT(*) as value
FROM email_logs
UNION ALL
SELECT 
  'Null Message IDs' as metric,
  COUNT(*) as value
FROM email_logs 
WHERE sg_message_id IS NULL
UNION ALL
SELECT 
  'Fallback Message IDs' as metric,
  COUNT(*) as value
FROM email_logs 
WHERE sg_message_id LIKE 'fallback-%'
UNION ALL
SELECT 
  'Failed Message IDs' as metric,
  COUNT(*) as value
FROM email_logs 
WHERE sg_message_id LIKE 'failed-%';
