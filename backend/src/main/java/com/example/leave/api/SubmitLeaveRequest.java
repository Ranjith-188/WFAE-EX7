package com.example.leave.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record SubmitLeaveRequest(
        @NotBlank(message = "Employee name is required")
        String employeeName,

        @NotBlank(message = "Employee email is required")
        @Email(message = "Valid employee email is required")
        String employeeEmail,

        @NotBlank(message = "Leave type is required")
        String leaveType,

        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "End date is required")
        LocalDate endDate,

        String reason
) {
}
