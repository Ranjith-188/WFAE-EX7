package com.example.leave.worker;

import com.example.leave.service.LeaveService;
import io.camunda.client.annotation.JobWorker;
import io.camunda.client.api.response.ActivatedJob;
import io.camunda.client.api.worker.JobClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class LeaveWorkers {

    private final LeaveService leaveService;

    @JobWorker(type = "validate-leave")
    public Map<String, Object> handleValidateLeave(final JobClient client, final ActivatedJob job) {
        log.info("Worker [validate-leave] activated for job key {}", job.getKey());
        Map<String, Object> vars = job.getVariablesAsMap();
        Object rawRequestId = vars.get("requestId");

        if (rawRequestId == null) {
            String errorMsg = "Missing required variable 'requestId' in job " + job.getKey();
            log.error(errorMsg);
            throw new IllegalArgumentException(errorMsg);
        }

        Long requestId = Long.valueOf(rawRequestId.toString());

        try {
            Map<String, Object> validationResult = leaveService.validate(requestId);
            log.info("Worker [validate-leave] completed for request #{}: valid={}",
                    requestId, validationResult.get("valid"));
            return validationResult;
        } catch (Exception e) {
            log.error("Error executing validate-leave for request #{}", requestId, e);
            throw new RuntimeException("Failed validating leave request #" + requestId + ": " + e.getMessage(), e);
        }
    }

    @JobWorker(type = "finalize-leave")
    public void handleFinalizeLeave(final JobClient client, final ActivatedJob job) {
        log.info("Worker [finalize-leave] activated for job key {}", job.getKey());
        Map<String, Object> vars = job.getVariablesAsMap();

        Object rawRequestId = vars.get("requestId");
        if (rawRequestId == null) {
            String errorMsg = "Missing required variable 'requestId' in job " + job.getKey();
            log.error(errorMsg);
            throw new IllegalArgumentException(errorMsg);
        }

        Long requestId = Long.valueOf(rawRequestId.toString());
        String outcome = (String) vars.get("outcome");
        boolean approved = "APPROVED".equalsIgnoreCase(outcome);

        String managerComment = (String) vars.get("managerComment");
        String validationMessage = (String) vars.get("validationMessage");

        try {
            leaveService.finalizeRequest(requestId, approved, managerComment, validationMessage);
            log.info("Worker [finalize-leave] completed for request #{}: outcome={}", requestId, outcome);
        } catch (Exception e) {
            log.error("Error executing finalize-leave for request #{}", requestId, e);
            throw new RuntimeException("Failed finalizing leave request #" + requestId + ": " + e.getMessage(), e);
        }
    }
}
