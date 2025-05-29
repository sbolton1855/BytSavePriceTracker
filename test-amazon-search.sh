#!/bin/bash

curl "https://webservices.amazon.com/paapi5/searchitems" \
-H "Host: webservices.amazon.com" \
-H "Accept: application/json, text/javascript" \
-H "Accept-Language: en-US" \
-H "Content-Type: application/json; charset=UTF-8" \
-H "X-Amz-Date: 20250529T034154Z" \
-H "X-Amz-Target: com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems" \
-H "Content-Encoding: amz-1.0" \
-H "Authorization: AWS4-HMAC-SHA256 Credential=AKIAJ5FQA5U7RIAD6M4Q/20250529/us-east-1/ProductAdvertisingAPI/aws4_request SignedHeaders=content-encoding;host;x-amz-date;x-amz-target Signature=518390161887bea8a6ee17ac6952706bc93124aa8b3bd65a67298241ae092caa" \
-d '{
    "Keywords": "usb charger",
    "Resources": [
        "ItemInfo.Title",
        "Offers.Listings.Price"
    ],
    "PartnerTag": "bytsave-20",
    "PartnerType": "Associates",
    "Marketplace": "www.amazon.com"
}' 