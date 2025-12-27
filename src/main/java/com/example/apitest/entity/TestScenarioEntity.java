package com.example.apitest.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "TEST_SCENARIO", indexes = {
    @Index(name = "IDX_SCENARIO_CASE", columnList = "CASE_ID, SCENARIO_ORDER"),
    @Index(name = "IDX_SCENARIO_NAME", columnList = "SCENARIO_NAME")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestScenarioEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "seq_test_scenario")
    @SequenceGenerator(name = "seq_test_scenario", sequenceName = "SEQ_TEST_SCENARIO", allocationSize = 1)
    @Column(name = "SCENARIO_ID")
    private Long scenarioId;
    
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "CASE_ID", nullable = false)
    private TestCaseEntity testCase;
    
    @Column(name = "SCENARIO_NAME", nullable = false, length = 500)
    private String scenarioName;
    
    @Column(name = "SCENARIO_ORDER", nullable = false)
    private Integer scenarioOrder;
    
    @Column(name = "VERSION_STATUS", length = 20)
    private String versionStatus = "DRAFT";
    
    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;
    
    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;
    
    @OneToMany(mappedBy = "scenario", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stepOrder ASC")
    @Builder.Default
    private List<TestStepEntity> steps = new ArrayList<>();
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    // 연관관계 편의 메서드
    public void addStep(TestStepEntity step) {
        steps.add(step);
        step.setScenario(this);
    }
    
    public void removeStep(TestStepEntity step) {
        steps.remove(step);
        step.setScenario(null);
    }
}
