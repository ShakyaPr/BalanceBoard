#!/usr/bin/env bash

set -euo pipefail

API_URL="${API_URL:-http://localhost:4000/api/statements}"

post_statement() {
  local label="$1"
  local payload="$2"

  echo "Seeding ${label}..."
  curl --silent --show-error --fail \
    --location "${API_URL}" \
    --header 'Content-Type: application/json' \
    --data "${payload}" >/dev/null
}

post_statement "Amex Blue - February 2026" '{
  "name": "Amex Blue",
  "date": "02/05/26",
  "minimum_amount": 1250.00,
  "monthly_amount": 8420.75,
  "due_date": "02/27/26",
  "transactions": [
    { "date": "01/18", "description": "Luxury Hotel Deposit", "amount": 1850.00, "type": "debit" },
    { "date": "01/22", "description": "Streaming Bundle", "amount": 28.99, "type": "debit" },
    { "date": "01/25", "description": "Airport Lounge", "amount": 75.50, "type": "debit" },
    { "date": "01/28", "description": "Designer Store", "amount": 1125.40, "type": "debit" },
    { "date": "02/01", "description": "Refund - Travel Credit", "amount": 120.00, "type": "credit" },
    { "date": "02/03", "description": "Fine Dining", "amount": 265.80, "type": "debit" }
  ]
}'

post_statement "Amex Blue - March 2026" '{
  "name": "Amex Blue",
  "date": "03/05/26",
  "minimum_amount": 1380.00,
  "monthly_amount": 9185.30,
  "due_date": "03/27/26",
  "transactions": [
    { "date": "02/17", "description": "Business Class Upgrade", "amount": 2350.00, "type": "debit" },
    { "date": "02/20", "description": "Online Masterclass", "amount": 149.00, "type": "debit" },
    { "date": "02/23", "description": "Boutique Wellness Spa", "amount": 310.25, "type": "debit" },
    { "date": "02/27", "description": "Refund - Retail Return", "amount": 95.00, "type": "credit" },
    { "date": "03/01", "description": "Private Car Hire", "amount": 420.75, "type": "debit" },
    { "date": "03/03", "description": "Art Gallery Purchase", "amount": 980.60, "type": "debit" }
  ]
}'

post_statement "Amex Blue - April 2026" '{
  "name": "Amex Blue",
  "date": "04/05/26",
  "minimum_amount": 1425.00,
  "monthly_amount": 9650.45,
  "due_date": "04/27/26",
  "transactions": [
    { "date": "03/18", "description": "Premium Airline Ticket", "amount": 2450.00, "type": "debit" },
    { "date": "03/21", "description": "Online Subscription", "amount": 19.99, "type": "debit" },
    { "date": "03/24", "description": "Executive Lounge Access", "amount": 88.50, "type": "debit" },
    { "date": "03/27", "description": "Refund", "amount": 55.25, "type": "credit" },
    { "date": "03/30", "description": "Bookstore", "amount": 27.80, "type": "debit" },
    { "date": "04/02", "description": "Fine Dining Tasting Menu", "amount": 315.40, "type": "debit" }
  ]
}'

post_statement "Visa Gold - February 2026" '{
  "name": "Visa Gold",
  "date": "02/01/26",
  "minimum_amount": 920.00,
  "monthly_amount": 5840.60,
  "due_date": "02/22/26",
  "transactions": [
    { "date": "01/14", "description": "Supermarket", "amount": 92.15, "type": "debit" },
    { "date": "01/18", "description": "Fuel Station", "amount": 48.70, "type": "debit" },
    { "date": "01/21", "description": "Pharmacy", "amount": 36.25, "type": "debit" },
    { "date": "01/24", "description": "Family Restaurant", "amount": 74.90, "type": "debit" },
    { "date": "01/27", "description": "Refund - Grocery Offer", "amount": 15.00, "type": "credit" },
    { "date": "01/30", "description": "Utility Bill", "amount": 126.40, "type": "debit" }
  ]
}'

post_statement "Visa Gold - March 2026" '{
  "name": "Visa Gold",
  "date": "03/01/26",
  "minimum_amount": 975.00,
  "monthly_amount": 6215.90,
  "due_date": "03/22/26",
  "transactions": [
    { "date": "02/13", "description": "Supermarket", "amount": 108.45, "type": "debit" },
    { "date": "02/16", "description": "Fuel Station", "amount": 61.10, "type": "debit" },
    { "date": "02/19", "description": "School Supplies", "amount": 42.30, "type": "debit" },
    { "date": "02/22", "description": "Weekend Cafe", "amount": 29.75, "type": "debit" },
    { "date": "02/25", "description": "Payment Reversal Credit", "amount": 35.00, "type": "credit" },
    { "date": "02/27", "description": "Home Internet", "amount": 98.90, "type": "debit" }
  ]
}'

post_statement "Visa Gold - April 2026" '{
  "name": "Visa Gold",
  "date": "04/01/26",
  "minimum_amount": 1040.00,
  "monthly_amount": 6548.25,
  "due_date": "04/22/26",
  "transactions": [
    { "date": "03/12", "description": "Supermarket", "amount": 115.25, "type": "debit" },
    { "date": "03/15", "description": "Fuel Station", "amount": 54.60, "type": "debit" },
    { "date": "03/18", "description": "Household Goods", "amount": 83.40, "type": "debit" },
    { "date": "03/21", "description": "Family Dinner", "amount": 68.90, "type": "debit" },
    { "date": "03/24", "description": "Refund - Retail Return", "amount": 22.50, "type": "credit" },
    { "date": "03/28", "description": "Mobile Bill", "amount": 44.80, "type": "debit" }
  ]
}'

post_statement "Mastercard Platinum - February 2026" '{
  "name": "Mastercard Platinum",
  "date": "02/03/26",
  "minimum_amount": 1680.00,
  "monthly_amount": 11240.80,
  "due_date": "02/25/26",
  "transactions": [
    { "date": "01/16", "description": "Electronics Store", "amount": 799.99, "type": "debit" },
    { "date": "01/19", "description": "Furniture Deposit", "amount": 1450.00, "type": "debit" },
    { "date": "01/22", "description": "Restaurant", "amount": 64.50, "type": "debit" },
    { "date": "01/26", "description": "Cashback Reward", "amount": 35.00, "type": "credit" },
    { "date": "01/29", "description": "Home Appliance", "amount": 620.30, "type": "debit" },
    { "date": "02/01", "description": "Warehouse Membership", "amount": 110.00, "type": "debit" }
  ]
}'

post_statement "Mastercard Platinum - March 2026" '{
  "name": "Mastercard Platinum",
  "date": "03/03/26",
  "minimum_amount": 1725.00,
  "monthly_amount": 11885.95,
  "due_date": "03/25/26",
  "transactions": [
    { "date": "02/14", "description": "Office Monitor", "amount": 920.00, "type": "debit" },
    { "date": "02/18", "description": "Premium Gym Membership", "amount": 140.00, "type": "debit" },
    { "date": "02/21", "description": "Weekend Resort", "amount": 1685.50, "type": "debit" },
    { "date": "02/24", "description": "Cashback Reward", "amount": 42.00, "type": "credit" },
    { "date": "02/27", "description": "Fine Dining", "amount": 188.75, "type": "debit" },
    { "date": "03/01", "description": "Department Store", "amount": 360.20, "type": "debit" }
  ]
}'

post_statement "Mastercard Platinum - April 2026" '{
  "name": "Mastercard Platinum",
  "date": "04/03/26",
  "minimum_amount": 1810.00,
  "monthly_amount": 12450.40,
  "due_date": "04/25/26",
  "transactions": [
    { "date": "03/15", "description": "Electronics Store", "amount": 1045.00, "type": "debit" },
    { "date": "03/18", "description": "Interior Decor", "amount": 870.40, "type": "debit" },
    { "date": "03/21", "description": "Restaurant", "amount": 72.60, "type": "debit" },
    { "date": "03/24", "description": "Cashback Reward", "amount": 38.00, "type": "credit" },
    { "date": "03/28", "description": "Appliance Service Plan", "amount": 215.00, "type": "debit" },
    { "date": "04/01", "description": "Luxury Bedding", "amount": 490.90, "type": "debit" }
  ]
}'

echo "Done. Seeded 9 statements for 3 cards across 3 months."
