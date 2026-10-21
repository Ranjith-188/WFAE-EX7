#!/usr/bin/env bash
# End-to-End Acceptance Test Script for Leave Application System
set -e

BASE_URL="http://localhost:8081/api/leaves"

echo "=================================================="
echo "  LEAVE APPLICATION SYSTEM - ACCEPTANCE TEST RUN  "
echo "=================================================="

# 1. Happy Path: Annual 3 weekdays -> Approved
echo ""
echo "--> Scenario 1: Happy Path"
EMP1="alice_curl@company.com"
INIT_BAL=$(curl -s "$BASE_URL/balance?employeeEmail=$EMP1" | grep -o '"remainingDays":[0-9]*' | cut -d: -f2)
echo "Initial balance: $INIT_BAL"

RESP1=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{
  "employeeName": "Alice Curl",
  "employeeEmail": "'"$EMP1"'",
  "leaveType": "Annual",
  "startDate": "2026-11-02",
  "endDate": "2026-11-04",
  "reason": "Family vacation"
}')
ID1=$(echo "$RESP1" | grep -o '"id":[0-9]*' | cut -d: -f2)
echo "Created Request #$ID1"
sleep 2

# Manager Approves
curl -s -X POST "$BASE_URL/$ID1/decision" -H "Content-Type: application/json" -d '{
  "approved": true,
  "comment": "Approved via curl"
}'
sleep 3

FINAL_BAL1=$(curl -s "$BASE_URL/balance?employeeEmail=$EMP1" | grep -o '"remainingDays":[0-9]*' | cut -d: -f2)
echo "New balance: $FINAL_BAL1 (expected: 17)"

# 2. Manager Rejection
echo ""
echo "--> Scenario 2: Manager Rejection"
EMP2="bob_curl@company.com"
RESP2=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{
  "employeeName": "Bob Curl",
  "employeeEmail": "'"$EMP2"'",
  "leaveType": "Annual",
  "startDate": "2026-11-05",
  "endDate": "2026-11-06"
}')
ID2=$(echo "$RESP2" | grep -o '"id":[0-9]*' | cut -d: -f2)
sleep 2

curl -s -X POST "$BASE_URL/$ID2/decision" -H "Content-Type: application/json" -d '{
  "approved": false,
  "comment": "Audit week"
}'
sleep 3
STATUS2=$(curl -s "$BASE_URL/$ID2" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "Request #$ID2 status: $STATUS2 (expected: REJECTED)"

# 3. Insufficient Balance
echo ""
echo "--> Scenario 3: Insufficient Balance"
RESP3=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{
  "employeeName": "Carol Curl",
  "employeeEmail": "carol_curl@company.com",
  "leaveType": "Annual",
  "startDate": "2026-11-02",
  "endDate": "2026-12-07"
}')
ID3=$(echo "$RESP3" | grep -o '"id":[0-9]*' | cut -d: -f2)
sleep 3
STATUS3=$(curl -s "$BASE_URL/$ID3" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "Request #$ID3 status: $STATUS3 (expected: REJECTED)"

# 4. No Working Days
echo ""
echo "--> Scenario 4: No Working Days (Weekend only)"
RESP4=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{
  "employeeName": "Dan Curl",
  "employeeEmail": "dan_curl@company.com",
  "leaveType": "Annual",
  "startDate": "2026-11-07",
  "endDate": "2026-11-08"
}')
ID4=$(echo "$RESP4" | grep -o '"id":[0-9]*' | cut -d: -f2)
sleep 3
STATUS4=$(curl -s "$BASE_URL/$ID4" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "Request #$ID4 status: $STATUS4 (expected: REJECTED)"

# 5. Bad Dates
echo ""
echo "--> Scenario 5: Bad Dates (End before start)"
RESP5=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{
  "employeeName": "Eve Curl",
  "employeeEmail": "eve_curl@company.com",
  "leaveType": "Annual",
  "startDate": "2026-11-10",
  "endDate": "2026-11-05"
}')
ID5=$(echo "$RESP5" | grep -o '"id":[0-9]*' | cut -d: -f2)
sleep 3
STATUS5=$(curl -s "$BASE_URL/$ID5" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "Request #$ID5 status: $STATUS5 (expected: REJECTED)"

# 6. Validation Error (HTTP 400)
echo ""
echo "--> Scenario 6: Validation Errors"
HTTP_CODE6=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{
  "employeeName": "",
  "employeeEmail": "invalid",
  "leaveType": ""
}')
echo "Validation error response code: $HTTP_CODE6 (expected: 400)"

# 7. Invalid Decision (HTTP 409)
echo ""
echo "--> Scenario 7: Invalid Decision on Non-Pending Request"
HTTP_CODE7=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/$ID3/decision" -H "Content-Type: application/json" -d '{
  "approved": true
}')
echo "Conflict response code: $HTTP_CODE7 (expected: 409)"

echo ""
echo "=================================================="
echo "  ALL ACCEPTANCE SCENARIOS EXECUTED SUCCESSFULLY  "
echo "=================================================="
