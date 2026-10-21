package com.example.leave.service;

import com.example.leave.api.DecisionRequest;
import com.example.leave.api.SubmitLeaveRequest;
import com.example.leave.domain.LeaveBalance;
import com.example.leave.domain.LeaveBalanceRepository;
import com.example.leave.domain.LeaveRequest;
import com.example.leave.domain.LeaveRequestRepository;
import com.example.leave.domain.LeaveStatus;
import io.camunda.client.CamundaClient;
import io.camunda.client.api.response.ProcessInstanceEvent;
import io.camunda.client.api.search.response.SearchResponse;
import io.camunda.client.api.search.response.UserTask;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
@Slf4j
public class LeaveService {

    private final LeaveRequestRepository requestRepository;
    private final LeaveBalanceRepository balanceRepository;
    private final CamundaClient camundaClient;

    public int calculateWorkingDays(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
            return 0;
        }
        int days = 0;
        LocalDate curr = startDate;
        while (!curr.isAfter(endDate)) {
            DayOfWeek dow = curr.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                days++;
            }
            curr = curr.plusDays(1);
        }
        return days;
    }

    @Transactional
    public LeaveBalance balance(String email) {
        if (email == null || email.isBlank()) {
            return new LeaveBalance("", 0);
        }
        return balanceRepository.findById(email.trim())
                .orElseGet(() -> balanceRepository.save(new LeaveBalance(email.trim(), 20)));
    }

    @Transactional
    public LeaveRequest submit(SubmitLeaveRequest submitDto) {
        log.info("Submitting leave request for {}", submitDto.employeeEmail());
        int days = calculateWorkingDays(submitDto.startDate(), submitDto.endDate());

        // Ensure default balance of 20 exists
        balance(submitDto.employeeEmail());

        // Save request FIRST
        LeaveRequest leaveRequest = new LeaveRequest();
        leaveRequest.setEmployeeName(submitDto.employeeName().trim());
        leaveRequest.setEmployeeEmail(submitDto.employeeEmail().trim());
        leaveRequest.setLeaveType(submitDto.leaveType());
        leaveRequest.setStartDate(submitDto.startDate());
        leaveRequest.setEndDate(submitDto.endDate());
        leaveRequest.setDays(days);
        leaveRequest.setReason(submitDto.reason());
        leaveRequest.setStatus(LeaveStatus.SUBMITTED);
        leaveRequest.setStatusMessage("Request submitted. Workflow started.");

        leaveRequest = requestRepository.saveAndFlush(leaveRequest);

        // Start Camunda process instance
        Map<String, Object> variables = new HashMap<>();
        variables.put("requestId", leaveRequest.getId());
        variables.put("employeeEmail", leaveRequest.getEmployeeEmail());
        variables.put("leaveType", leaveRequest.getLeaveType());
        variables.put("days", leaveRequest.getDays());
        variables.put("startDate", leaveRequest.getStartDate().toString());
        variables.put("endDate", leaveRequest.getEndDate().toString());

        try {
            ProcessInstanceEvent processInstance = camundaClient.newCreateInstanceCommand()
                    .bpmnProcessId("leave-request")
                    .latestVersion()
                    .variables(variables)
                    .send()
                    .join();

            Long processInstanceKey = processInstance.getProcessInstanceKey();
            log.info("Process instance started with key {}", processInstanceKey);

            // Safe update query that touches ONLY processInstanceKey
            requestRepository.updateProcessInstanceKeyOnly(leaveRequest.getId(), processInstanceKey);
            leaveRequest.setProcessInstanceKey(processInstanceKey);
        } catch (Exception e) {
            log.error("Failed to start Camunda process instance for request #{}", leaveRequest.getId(), e);
            leaveRequest.setStatusMessage("Failed to initiate workflow: " + e.getMessage());
            requestRepository.save(leaveRequest);
            throw new RuntimeException("Camunda workflow initiation failed: " + e.getMessage(), e);
        }

        return leaveRequest;
    }

    @Transactional
    public Map<String, Object> validate(Long requestId) {
        log.info("Validating leave request #{}", requestId);
        LeaveRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new NoSuchElementException("Leave request #" + requestId + " not found"));

        boolean valid = true;
        String message = "Leave request valid. Pending manager approval.";

        if (req.getEndDate().isBefore(req.getStartDate())) {
            valid = false;
            message = "Validation rejected: End date (" + req.getEndDate() + ") is before start date (" + req.getStartDate() + ").";
        } else if (req.getDays() == 0) {
            valid = false;
            message = "Validation rejected: No working days in selected range (weekends only).";
        } else if ("Annual".equalsIgnoreCase(req.getLeaveType())) {
            LeaveBalance bal = balance(req.getEmployeeEmail());
            if (bal.getRemainingDays() < req.getDays()) {
                valid = false;
                message = "Validation rejected: Insufficient annual leave balance. Requested " + req.getDays()
                        + " days, but remaining balance is " + bal.getRemainingDays() + " days.";
            }
        }

        if (valid) {
            req.setStatus(LeaveStatus.PENDING_APPROVAL);
            req.setStatusMessage(message);
        } else {
            // Note: final rejection status is set by the finalize-leave worker
            req.setStatusMessage(message);
        }

        requestRepository.save(req);

        Map<String, Object> result = new HashMap<>();
        result.put("valid", valid);
        result.put("validationMessage", message);
        return result;
    }

    @Transactional
    public void decide(Long id, DecisionRequest decision) {
        log.info("Manager deciding on request #{}: approved={}", id, decision.approved());
        LeaveRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Leave request #" + id + " not found"));

        if (req.getStatus() != LeaveStatus.PENDING_APPROVAL) {
            throw new IllegalStateException("Request #" + id + " is not in PENDING_APPROVAL status (current: " + req.getStatus() + ")");
        }

        if (req.getProcessInstanceKey() == null) {
            throw new IllegalStateException("Request #" + id + " has no associated Camunda process instance");
        }

        // Search for user task in Camunda 8
        SearchResponse<UserTask> searchResponse = camundaClient.newUserTaskSearchRequest()
                .filter(f -> f.processInstanceKey(req.getProcessInstanceKey()))
                .send()
                .join();

        List<UserTask> tasks = searchResponse.items();
        if (tasks == null || tasks.isEmpty()) {
            throw new IllegalStateException("No active user task found in Camunda for process instance " + req.getProcessInstanceKey());
        }

        UserTask task = tasks.get(0);
        long userTaskKey = task.getUserTaskKey();
        log.info("Found user task {} for instance {}", userTaskKey, req.getProcessInstanceKey());

        Map<String, Object> decisionVars = new HashMap<>();
        decisionVars.put("approved", decision.approved());
        decisionVars.put("managerComment", decision.comment() != null ? decision.comment().trim() : "");

        camundaClient.newCompleteUserTaskCommand(userTaskKey)
                .variables(decisionVars)
                .send()
                .join();

        log.info("Completed user task {} with decision approved={}", userTaskKey, decision.approved());
    }

    @Transactional
    public void finalizeRequest(Long id, boolean approved, String managerComment, String validationMessage) {
        log.info("Finalizing request #{}: approved={}", id, approved);
        LeaveRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Leave request #" + id + " not found"));

        // Idempotency: if already finalized as APPROVED or REJECTED, avoid double-processing
        if (req.getStatus() == LeaveStatus.APPROVED || req.getStatus() == LeaveStatus.REJECTED) {
            log.warn("Request #{} is already in terminal state {}, skipping finalize", id, req.getStatus());
            return;
        }

        if (approved) {
            req.setStatus(LeaveStatus.APPROVED);
            String commentMsg = (managerComment != null && !managerComment.isBlank())
                    ? " Manager comment: " + managerComment
                    : "";
            req.setStatusMessage("Leave approved by manager." + commentMsg);

            // Deduct annual leave balance
            if ("Annual".equalsIgnoreCase(req.getLeaveType())) {
                LeaveBalance bal = balance(req.getEmployeeEmail());
                int newBal = Math.max(0, bal.getRemainingDays() - req.getDays());
                bal.setRemainingDays(newBal);
                balanceRepository.save(bal);
                log.info("Deducted {} days from {} balance. New balance: {}", req.getDays(), req.getEmployeeEmail(), newBal);
            }
        } else {
            req.setStatus(LeaveStatus.REJECTED);
            if (managerComment != null && !managerComment.isBlank()) {
                req.setStatusMessage("Rejected by manager: " + managerComment);
            } else if (validationMessage != null && !validationMessage.isBlank()) {
                req.setStatusMessage(validationMessage);
            } else {
                req.setStatusMessage("Leave request was rejected.");
            }
        }

        requestRepository.save(req);

        // Notification hook
        notifyEmployee(req);
    }

    public List<LeaveRequest> getRequestsByEmail(String email) {
        return requestRepository.findByEmployeeEmailOrderByCreatedAtDesc(email.trim());
    }

    public List<LeaveRequest> getPendingRequests() {
        return requestRepository.findByStatusOrderByCreatedAtAsc(LeaveStatus.PENDING_APPROVAL);
    }

    public LeaveRequest getRequest(Long id) {
        return requestRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Leave request #" + id + " not found"));
    }

    private void notifyEmployee(LeaveRequest req) {
        log.info(">>> NOTIFICATION HOOK: Leave Request #{} for {} ({}) finalized with status: {} [Message: {}] <<<",
                req.getId(), req.getEmployeeName(), req.getEmployeeEmail(), req.getStatus(), req.getStatusMessage());
    }
}
