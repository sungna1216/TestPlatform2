package com.example.apitest.controller;

import com.example.apitest.dto.TestExecutionRequest;
import com.example.apitest.dto.TestExecutionResult;
import com.example.apitest.service.TestExecutionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/test-execution")
public class TestExecutionController {
    
    @Autowired
    private TestExecutionService testExecutionService;
    
    @PostMapping("/start")
    public ResponseEntity<String> startExecution(@RequestBody TestExecutionRequest request) {
        String executionId = testExecutionService.startExecution(request);
        return ResponseEntity.ok(executionId);
    }
    
    @GetMapping("/{executionId}")
    public ResponseEntity<TestExecutionResult> getResult(@PathVariable String executionId) {
        TestExecutionResult result = testExecutionService.getResult(executionId);
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result);
    }
    
    @PostMapping("/{executionId}/pause")
    public ResponseEntity<Void> pauseExecution(@PathVariable String executionId) {
        testExecutionService.pauseExecution(executionId);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{executionId}/resume")
    public ResponseEntity<Void> resumeExecution(@PathVariable String executionId) {
        testExecutionService.resumeExecution(executionId);
        return ResponseEntity.ok().build();
    }
}
