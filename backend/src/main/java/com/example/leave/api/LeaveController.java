package com.example.leave.api;

import com.example.leave.domain.LeaveBalance;
import com.example.leave.domain.LeaveRequest;
import com.example.leave.service.LeaveService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leaves")
@RequiredArgsConstructor
@Slf4j
public class LeaveController {

    private final LeaveService leaveService;

    @PostMapping
    public ResponseEntity<LeaveRequest> submit(@Valid @RequestBody SubmitLeaveRequest request) {
        log.info("REST: POST /api/leaves - submit request from {}", request.employeeEmail());
        LeaveRequest created = leaveService.submit(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<LeaveRequest>> getMyLeaves(@RequestParam(required = false) String employeeEmail) {
        if (employeeEmail == null || employeeEmail.isBlank()) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(leaveService.getRequestsByEmail(employeeEmail));
    }

    @GetMapping("/pending")
    public ResponseEntity<List<LeaveRequest>> getPending() {
        return ResponseEntity.ok(leaveService.getPendingRequests());
    }

    @GetMapping("/{id}")
    public ResponseEntity<LeaveRequest> getById(@PathVariable Long id) {
        return ResponseEntity.ok(leaveService.getRequest(id));
    }

    @PostMapping("/{id}/decision")
    public ResponseEntity<Void> decide(@PathVariable Long id, @RequestBody DecisionRequest decision) {
        log.info("REST: POST /api/leaves/{}/decision - decision: {}", id, decision);
        leaveService.decide(id, decision);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/balance")
    public ResponseEntity<BalanceResponse> getBalance(@RequestParam String employeeEmail) {
        LeaveBalance bal = leaveService.balance(employeeEmail);
        return ResponseEntity.ok(new BalanceResponse(bal.getRemainingDays()));
    }
}
