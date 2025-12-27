package com.example.apitest.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "TEST_STEP", indexes = {
    @Index(name = "IDX_STEP_SCENARIO", columnList = "SCENARIO_ID, STEP_ORDER"),
    @Index(name = "IDX_STEP_CASE_NO", columnList = "CASE_NO"),
    @Index(name = "IDX_STEP_PRIORITY", columnList = "PRIORITY, VERSION_STATUS")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestStepEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "seq_test_step")
    @SequenceGenerator(name = "seq_test_step", sequenceName = "SEQ_TEST_STEP", allocationSize = 1)
    @Column(name = "STEP_ID")
    private Long stepId;
    
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "SCENARIO_ID", nullable = false)
    private TestScenarioEntity scenario;
    
    @Column(name = "CASE_NO", nullable = false, length = 10)
    private String caseNo;
    
    @Column(name = "STEP_ORDER", nullable = false)
    private Integer stepOrder;
    
    @Column(name = "PRIORITY", length = 20)
    private String priority = "보통";
    
    // 📌 JSON 저장 (순수 JSON 방식, 정규화 컬럼 없음)
    @Lob
    @Column(name = "REQUEST_JSON", nullable = false)
    private String requestJson;
    
    @Lob
    @Column(name = "EXPECTED_JSON", nullable = false)
    private String expectedJson;
    
    @Column(name = "VERSION_STATUS", length = 20)
    private String versionStatus = "DRAFT";
    
    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;
    
    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
