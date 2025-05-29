#!/bin/bash

# Minimal test with only required fields
curl --location --request POST 'https://webservices.amazon.com/paapi5/searchitems' \
--header 'Content-Type: application/json; charset=UTF-8' \
--header 'Content-Encoding: amz-1.0' \
--header 'Host: webservices.amazon.com' \
--header 'X-Amz-Date: 20250529T034154Z' \
--header 'X-Amz-Target: com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems' \
--header 'Authorization: AWS4-HMAC-SHA256 Credential=AKIAJ5FQA5U7RIAD6M4Q/20250529/us-east-1/ProductAdvertisingAPI/aws4_request SignedHeaders=content-encoding;host;x-amz-date;x-amz-target Signature=518390161887bea8a6ee17ac6952706bc93124aa8b3bd65a67298241ae092caa' \
--data-raw '{
  "Keywords": "usb charger",
  "PartnerTag": "bytsave-20",
  "PartnerType": "Associates",
  "Marketplace": "www.amazon.com"
}' 