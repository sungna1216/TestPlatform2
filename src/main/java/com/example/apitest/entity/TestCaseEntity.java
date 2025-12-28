package com.example.apitest.entity;

import lombok.*;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "TEST_CASE")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestCaseEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "seq_test_case")
    @SequenceGenerator(name = "seq_test_case", sequenceName = "SEQ_TEST_CASE", allocationSize = 1)
    @Column(name = "CASE_ID")
    private Long caseId;
    
    @Column(name = "FILE_NAME", nullable = false, unique = true, length = 255)
    private String fileName;
    
    @Column(name = "TITLE", nullable = false, length = 500)
    private String title;
    
    @Lob
    @Column(name = "NOTE")
    private String note;
    
    @Column(name = "VERSION_STATUS", length = 20)
    private String versionStatus = "DRAFT"; // DRAFT, PUBLISHED
    
    @Column(name = "VERSION_NUMBER")
    private Integer versionNumber = 1;
    
    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;
    
    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;
    
    @Column(name = "CREATED_BY", length = 100)
    private String createdBy = "system";
    
    @Column(name = "UPDATED_BY", length = 100)
    private String updatedBy = "system";
    
    @Column(name = "TAGS", length = 500)
    private String tags;
    
    @Column(name = "CATEGORY", length = 100)
    private String category;
    
    @Column(name = "IS_ACTIVE", length = 1)
    private String isActive = "Y";
    
    @Column(name = "LAST_RUN_AT")
    private LocalDateTime lastRunAt;
    
    @Column(name = "PARTITION_DATE")
    private LocalDateTime partitionDate;
    
    @OneToMany(mappedBy = "testCase", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TestScenarioEntity> scenarios = new ArrayList<>();
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        partitionDate = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    // 연관관계 편의 메서드
    public void addScenario(TestScenarioEntity scenario) {
        scenarios.add(scenario);
        scenario.setTestCase(this);
    }
    
    public void removeScenario(TestScenarioEntity scenario) {
        scenarios.remove(scenario);
        scenario.setTestCase(null);
    }
}
