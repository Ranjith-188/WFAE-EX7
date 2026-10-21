# End-to-End Acceptance Test Suite for Leave Application System
$baseUrl = "http://localhost:8081/api/leaves"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  LEAVE APPLICATION SYSTEM - ACCEPTANCE TEST RUN  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Assert-Condition($description, $condition) {
    if ($condition) {
        Write-Host " [PASS] $description" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $description" -ForegroundColor Red
        $script:failed++
    }
}

# -------------------------------------------------------------
# TEST 1: Happy Path (Annual leave of 3 weekdays, approved)
# -------------------------------------------------------------
Write-Host "`n--> Scenario 1: Happy Path (Annual 3 weekdays -> Approved)" -ForegroundColor Yellow
$emp1 = "alice_happy@company.com"

# Check initial balance (should be 20)
$initBal = (Invoke-RestMethod -Uri "$baseUrl/balance?employeeEmail=$emp1").remainingDays
Assert-Condition "Initial balance is 20 days" ($initBal -eq 20)

# Submit 3 weekdays (Mon 2026-11-02 to Wed 2026-11-04)
$body1 = @{
    employeeName = "Alice Happy"
    employeeEmail = $emp1
    leaveType = "Annual"
    startDate = "2026-11-02"
    endDate = "2026-11-04"
    reason = "Family vacation trip"
} | ConvertTo-Json

$req1 = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body1 -ContentType "application/json"
$id1 = $req1.id
Write-Host "Created Leave Request #$id1 with process key $($req1.processInstanceKey)"

# Wait for worker validation to set status PENDING_APPROVAL
Start-Sleep -Seconds 2
$req1Check = Invoke-RestMethod -Uri "$baseUrl/$id1"
Assert-Condition "Status transitioned to PENDING_APPROVAL" ($req1Check.status -eq "PENDING_APPROVAL")
Assert-Condition "Working days calculated correctly as 3" ($req1Check.days -eq 3)

# Verify it appears in Manager Inbox (/api/leaves/pending)
$pending = Invoke-RestMethod -Uri "$baseUrl/pending"
$foundInPending = $false
foreach ($p in $pending) {
    if ($p.id -eq $id1) { $foundInPending = $true; break }
}
Assert-Condition "Request appears in Manager Inbox (/api/leaves/pending)" $foundInPending

# Manager approves the request
$decisionBody1 = @{
    approved = $true
    comment = "Approved, have a great vacation Alice!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$baseUrl/$id1/decision" -Method Post -Body $decisionBody1 -ContentType "application/json"

# Wait for finalize-leave worker
Start-Sleep -Seconds 3
$req1Final = Invoke-RestMethod -Uri "$baseUrl/$id1"
Assert-Condition "Status transitioned to APPROVED" ($req1Final.status -eq "APPROVED")
Assert-Condition "Status message contains approval and manager note" ($req1Final.statusMessage -like "*Approved by manager*")

# Verify balance dropped by 3 (from 20 to 17)
$newBal1 = (Invoke-RestMethod -Uri "$baseUrl/balance?employeeEmail=$emp1").remainingDays
Assert-Condition "Remaining balance dropped by 3 (now 17)" ($newBal1 -eq 17)


# -------------------------------------------------------------
# TEST 2: Manager Rejection
# -------------------------------------------------------------
Write-Host "`n--> Scenario 2: Manager Rejection (Status REJECTED, balance unchanged)" -ForegroundColor Yellow
$emp2 = "bob_reject@company.com"

# Submit 2 weekdays
$body2 = @{
    employeeName = "Bob Smith"
    employeeEmail = $emp2
    leaveType = "Annual"
    startDate = "2026-11-05"
    endDate = "2026-11-06"
    reason = "Personal work"
} | ConvertTo-Json

$req2 = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body2 -ContentType "application/json"
$id2 = $req2.id

Start-Sleep -Seconds 2
$req2Check = Invoke-RestMethod -Uri "$baseUrl/$id2"
Assert-Condition "Request #$id2 is PENDING_APPROVAL" ($req2Check.status -eq "PENDING_APPROVAL")

# Manager rejects with comment
$decisionBody2 = @{
    approved = $false
    comment = "Quarter end audit that week, request cannot be accommodated"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$baseUrl/$id2/decision" -Method Post -Body $decisionBody2 -ContentType "application/json"

# Wait for finalize-leave worker
Start-Sleep -Seconds 3
$req2Final = Invoke-RestMethod -Uri "$baseUrl/$id2"
Assert-Condition "Status is REJECTED" ($req2Final.status -eq "REJECTED")
Assert-Condition "Manager comment is visible in status message" ($req2Final.statusMessage -like "*Quarter end audit*")

# Verify balance is unchanged (20)
$newBal2 = (Invoke-RestMethod -Uri "$baseUrl/balance?employeeEmail=$emp2").remainingDays
Assert-Condition "Balance unchanged at 20" ($newBal2 -eq 20)


# -------------------------------------------------------------
# TEST 3: Insufficient Balance
# -------------------------------------------------------------
Write-Host "`n--> Scenario 3: Insufficient Balance (Direct rejection by worker)" -ForegroundColor Yellow
$emp3 = "carol_over@company.com"

# Request 25 days (more than initial 20 balance)
$body3 = @{
    employeeName = "Carol Over"
    employeeEmail = $emp3
    leaveType = "Annual"
    startDate = "2026-11-02"
    endDate = "2026-12-07"
    reason = "Long sabbatical"
} | ConvertTo-Json

$req3 = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body3 -ContentType "application/json"
$id3 = $req3.id

# Wait for validation and finalize workers
Start-Sleep -Seconds 3
$req3Final = Invoke-RestMethod -Uri "$baseUrl/$id3"
Assert-Condition "Status went directly to REJECTED" ($req3Final.status -eq "REJECTED")
Assert-Condition "Status message clearly states Insufficient balance" ($req3Final.statusMessage -like "*Insufficient annual leave balance*")

# Check it never appears in Manager Inbox
$pendingNow = Invoke-RestMethod -Uri "$baseUrl/pending"
$foundCarol = $false
foreach ($p in $pendingNow) {
    if ($p.id -eq $id3) { $foundCarol = $true; break }
}
Assert-Condition "Request never reached Manager Inbox" (-not $foundCarol)


# -------------------------------------------------------------
# TEST 4: No Working Days (Weekend only)
# -------------------------------------------------------------
Write-Host "`n--> Scenario 4: No Working Days (Weekend only)" -ForegroundColor Yellow
$emp4 = "dan_weekend@company.com"

# Saturday 2026-11-07 to Sunday 2026-11-08
$body4 = @{
    employeeName = "Dan Weekend"
    employeeEmail = $emp4
    leaveType = "Annual"
    startDate = "2026-11-07"
    endDate = "2026-11-08"
    reason = "Weekend trip"
} | ConvertTo-Json

$req4 = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body4 -ContentType "application/json"
$id4 = $req4.id

Start-Sleep -Seconds 3
$req4Final = Invoke-RestMethod -Uri "$baseUrl/$id4"
Assert-Condition "Status rejected due to 0 working days" ($req4Final.status -eq "REJECTED")
Assert-Condition "Status message mentions weekends only" ($req4Final.statusMessage -like "*No working days*")


# -------------------------------------------------------------
# TEST 5: Bad Dates (End before start)
# -------------------------------------------------------------
Write-Host "`n--> Scenario 5: Bad Dates (End before start)" -ForegroundColor Yellow
$emp5 = "eve_baddate@company.com"

$body5 = @{
    employeeName = "Eve BadDate"
    employeeEmail = $emp5
    leaveType = "Annual"
    startDate = "2026-11-10"
    endDate = "2026-11-05"
} | ConvertTo-Json

$req5 = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body5 -ContentType "application/json"
$id5 = $req5.id

Start-Sleep -Seconds 3
$req5Final = Invoke-RestMethod -Uri "$baseUrl/$id5"
Assert-Condition "Status rejected for invalid date range" ($req5Final.status -eq "REJECTED")
Assert-Condition "Status message specifies end date before start date" ($req5Final.statusMessage -like "*is before start date*")


# -------------------------------------------------------------
# TEST 6: Validation Errors (HTTP 400 with details)
# -------------------------------------------------------------
Write-Host "`n--> Scenario 6: Validation Errors (HTTP 400)" -ForegroundColor Yellow

$badBody = @{
    employeeName = ""
    employeeEmail = "not-an-email"
    leaveType = ""
    startDate = $null
    endDate = $null
} | ConvertTo-Json

try {
    $res = Invoke-WebRequest -Uri $baseUrl -Method Post -Body $badBody -ContentType "application/json" -UseBasicParsing
    Assert-Condition "Validation failure did not return 400" $false
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert-Condition "Invalid payload returned HTTP 400" ($statusCode -eq 400)
}


# -------------------------------------------------------------
# TEST 7: Invalid Decision on Non-Pending Request (HTTP 409)
# -------------------------------------------------------------
Write-Host "`n--> Scenario 7: Invalid Decision on Non-Pending Request (HTTP 409)" -ForegroundColor Yellow

# Try deciding on already rejected request #$id3
try {
    $res = Invoke-WebRequest -Uri "$baseUrl/$id3/decision" -Method Post -Body (@{ approved = $true } | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
    Assert-Condition "Decision on rejected request did not return 409" $false
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert-Condition "Deciding on non-pending request returns HTTP 409 Conflict" ($statusCode -eq 409)
}

# -------------------------------------------------------------
# Summary
# -------------------------------------------------------------
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "==================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
