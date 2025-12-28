package com.example.apitest.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class TestExecutionResult {
    private String executionId;
    private String status; // RUNNING, PAUSED, COMPLETED
    private int totalSteps;
    private int completedSteps;
    private int passedSteps;
    private int failedSteps;
    private List<ScenarioResult> scenarioResults;
    
    @Data
    public static class ScenarioResult {
        private String scenarioName;
        private List<StepResult> stepResults;
        private String status; // RUNNING, COMPLETED, FAILED
    }
    
    @Data
    public static class StepResult {
        private String caseNo;
        private String priority;
        private String status; // PASS, FAIL, RUNNING, PENDING
        private Map<String, String> requestData; // Request fields
        private Map<String, FieldComparison> fieldComparisons;
        private long executionTime; // milliseconds (duration)
        private long executionTimestamp; // timestamp in milliseconds
        private String errorMessage;
    }
    
    @Data
    public static class FieldComparison {
        private String expectedValue;
        private String actualValue;
        private boolean match;
    }
}
