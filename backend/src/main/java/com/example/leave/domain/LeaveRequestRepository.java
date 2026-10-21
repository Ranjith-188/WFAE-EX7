package com.example.leave.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {

    List<LeaveRequest> findByEmployeeEmailOrderByCreatedAtDesc(String employeeEmail);

    List<LeaveRequest> findByStatusOrderByCreatedAtAsc(LeaveStatus status);

    @Modifying
    @Query("UPDATE LeaveRequest r SET r.processInstanceKey = :processInstanceKey WHERE r.id = :id")
    int updateProcessInstanceKeyOnly(@Param("id") Long id, @Param("processInstanceKey") Long processInstanceKey);
}
