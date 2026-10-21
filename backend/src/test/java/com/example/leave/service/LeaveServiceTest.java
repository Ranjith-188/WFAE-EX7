package com.example.leave.service;

import com.example.leave.domain.LeaveBalance;
import com.example.leave.domain.LeaveBalanceRepository;
import com.example.leave.domain.LeaveRequest;
import com.example.leave.domain.LeaveRequestRepository;
import com.example.leave.domain.LeaveStatus;
import io.camunda.client.CamundaClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeaveServiceTest {

    @Mock
    private LeaveRequestRepository requestRepository;

    @Mock
    private LeaveBalanceRepository balanceRepository;

    @Mock
    private CamundaClient camundaClient;

    @InjectMocks
    private LeaveService leaveService;

    private LeaveBalance sampleBalance;

    @BeforeEach
    void setUp() {
        sampleBalance = new LeaveBalance("alice@company.com", 20);
    }

    @Test
    @DisplayName("Should correctly count weekdays excluding weekends")
    void testCalculateWorkingDays() {
        // Monday (2026-10-26) to Wednesday (2026-10-28) -> 3 days
        LocalDate mon = LocalDate.of(2026, 10, 26);
        LocalDate wed = LocalDate.of(2026, 10, 28);
        assertEquals(3, leaveService.calculateWorkingDays(mon, wed));

        // Friday (2026-10-23) to Monday (2026-10-26) -> 2 days (Fri, Mon)
        LocalDate fri = LocalDate.of(2026, 10, 23);
        assertEquals(2, leaveService.calculateWorkingDays(fri, mon));

        // Saturday (2026-10-24) to Sunday (2026-10-25) -> 0 days
        LocalDate sat = LocalDate.of(2026, 10, 24);
        LocalDate sun = LocalDate.of(2026, 10, 25);
        assertEquals(0, leaveService.calculateWorkingDays(sat, sun));

        // End before start -> 0 days
        assertEquals(0, leaveService.calculateWorkingDays(wed, mon));
    }

    @Test
    @DisplayName("validate() should succeed and set PENDING_APPROVAL when balance is sufficient")
    void testValidateSuccess() {
        LeaveRequest req = new LeaveRequest();
        req.setId(1L);
        req.setEmployeeEmail("alice@company.com");
        req.setLeaveType("Annual");
        req.setStartDate(LocalDate.of(2026, 11, 2)); // Monday
        req.setEndDate(LocalDate.of(2026, 11, 4));   // Wednesday
        req.setDays(3);
        req.setStatus(LeaveStatus.SUBMITTED);

        when(requestRepository.findById(1L)).thenReturn(Optional.of(req));
        when(balanceRepository.findById("alice@company.com")).thenReturn(Optional.of(sampleBalance));

        Map<String, Object> result = leaveService.validate(1L);

        assertTrue((Boolean) result.get("valid"));
        assertEquals(LeaveStatus.PENDING_APPROVAL, req.getStatus());
        verify(requestRepository).save(req);
    }

    @Test
    @DisplayName("validate() should fail when requested Annual days exceed remaining balance")
    void testValidateInsufficientBalance() {
        LeaveRequest req = new LeaveRequest();
        req.setId(2L);
        req.setEmployeeEmail("alice@company.com");
        req.setLeaveType("Annual");
        req.setStartDate(LocalDate.of(2026, 11, 2));
        req.setEndDate(LocalDate.of(2026, 11, 27));
        req.setDays(20);
        req.setStatus(LeaveStatus.SUBMITTED);

        LeaveBalance lowBalance = new LeaveBalance("alice@company.com", 5);
        when(requestRepository.findById(2L)).thenReturn(Optional.of(req));
        when(balanceRepository.findById("alice@company.com")).thenReturn(Optional.of(lowBalance));

        Map<String, Object> result = leaveService.validate(2L);

        assertFalse((Boolean) result.get("valid"));
        assertTrue(result.get("validationMessage").toString().contains("Insufficient annual leave balance"));
        assertEquals(LeaveStatus.SUBMITTED, req.getStatus()); // Does not become PENDING_APPROVAL
    }

    @Test
    @DisplayName("validate() should fail when days == 0 (weekends only)")
    void testValidateZeroWorkingDays() {
        LeaveRequest req = new LeaveRequest();
        req.setId(3L);
        req.setEmployeeEmail("alice@company.com");
        req.setLeaveType("Annual");
        req.setStartDate(LocalDate.of(2026, 11, 7)); // Saturday
        req.setEndDate(LocalDate.of(2026, 11, 8));   // Sunday
        req.setDays(0);
        req.setStatus(LeaveStatus.SUBMITTED);

        when(requestRepository.findById(3L)).thenReturn(Optional.of(req));

        Map<String, Object> result = leaveService.validate(3L);

        assertFalse((Boolean) result.get("valid"));
        assertTrue(result.get("validationMessage").toString().contains("No working days in selected range"));
    }

    @Test
    @DisplayName("finalizeRequest() on approval should set APPROVED and deduct balance")
    void testFinalizeRequestApproved() {
        LeaveRequest req = new LeaveRequest();
        req.setId(10L);
        req.setEmployeeEmail("alice@company.com");
        req.setLeaveType("Annual");
        req.setDays(3);
        req.setStatus(LeaveStatus.PENDING_APPROVAL);

        when(requestRepository.findById(10L)).thenReturn(Optional.of(req));
        when(balanceRepository.findById("alice@company.com")).thenReturn(Optional.of(sampleBalance));

        leaveService.finalizeRequest(10L, true, "Approved, enjoy your vacation", null);

        assertEquals(LeaveStatus.APPROVED, req.getStatus());
        assertEquals(17, sampleBalance.getRemainingDays());
        verify(balanceRepository).save(sampleBalance);
        verify(requestRepository).save(req);
    }

    @Test
    @DisplayName("finalizeRequest() on rejection should set REJECTED and NOT deduct balance")
    void testFinalizeRequestRejected() {
        LeaveRequest req = new LeaveRequest();
        req.setId(11L);
        req.setEmployeeEmail("alice@company.com");
        req.setLeaveType("Annual");
        req.setDays(3);
        req.setStatus(LeaveStatus.PENDING_APPROVAL);

        when(requestRepository.findById(11L)).thenReturn(Optional.of(req));

        leaveService.finalizeRequest(11L, false, "Critical project release that week", null);

        assertEquals(LeaveStatus.REJECTED, req.getStatus());
        assertEquals(20, sampleBalance.getRemainingDays());
        verify(balanceRepository, never()).save(any(LeaveBalance.class));
        verify(requestRepository).save(req);
    }

    @Test
    @DisplayName("finalizeRequest() should be idempotent and not deduct balance twice")
    void testFinalizeRequestIdempotent() {
        LeaveRequest req = new LeaveRequest();
        req.setId(12L);
        req.setEmployeeEmail("alice@company.com");
        req.setLeaveType("Annual");
        req.setDays(3);
        req.setStatus(LeaveStatus.APPROVED); // Already finalized

        when(requestRepository.findById(12L)).thenReturn(Optional.of(req));

        leaveService.finalizeRequest(12L, true, "Duplicate call", null);

        // Balance repo never called because already APPROVED
        verify(balanceRepository, never()).save(any(LeaveBalance.class));
        assertEquals(LeaveStatus.APPROVED, req.getStatus());
    }
}
