package com.example.apitest.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class TestExecutionRequest {
    private List<ScenarioExecution> scenarios;
    private boolean parallel = true; // default: parallel execution
    
    @Data
    public static class ScenarioExecution {
        private String scenarioName;
        private List<StepExecution> steps;
    }
    
    @Data
    public static class StepExecution {
        private String caseNo;
        private String priority;
        private Map<String, String> requestData;  // key-value pairs
        private Map<String, String> expectedData; // key-value pairs
    }
}
