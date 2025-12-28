package com.example.apitest.service;

import com.example.apitest.dto.TestExecutionRequest;
import com.example.apitest.dto.TestExecutionResult;
import com.example.apitest.dto.TestExecutionResult.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.Socket;
import java.nio.charset.Charset;
import java.util.*;
import java.util.concurrent.*;

@Service
public class TestExecutionService {
    
    private static final Logger log = LoggerFactory.getLogger(TestExecutionService.class);
    private static final Charset MS949 = Charset.forName("MS949");
    private static final String TCP_HOST = "localhost";
    private static final int TCP_PORT = 9090;
    
    private final Map<String, TestExecutionContext> executionContexts = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newCachedThreadPool();
    
    public String startExecution(TestExecutionRequest request) {
        String executionId = UUID.randomUUID().toString();
        
        TestExecutionContext context = new TestExecutionContext();
        context.executionId = executionId;
        context.request = request;
        context.result = new TestExecutionResult();
        context.result.setExecutionId(executionId);
        context.result.setStatus("RUNNING");
        context.result.setScenarioResults(new ArrayList<>());
        context.paused = false;
        
        int totalSteps = request.getScenarios().stream()
            .mapToInt(s -> s.getSteps().size())
            .sum();
        context.result.setTotalSteps(totalSteps);
        context.result.setCompletedSteps(0);
        context.result.setPassedSteps(0);
        context.result.setFailedSteps(0);
        
        executionContexts.put(executionId, context);
        
        // Execute scenarios in parallel
        executorService.submit(() -> executeScenarios(context));
        
        return executionId;
    }
    
    public TestExecutionResult getResult(String executionId) {
        TestExecutionContext context = executionContexts.get(executionId);
        return context != null ? context.result : null;
    }
    
    public void pauseExecution(String executionId) {
        TestExecutionContext context = executionContexts.get(executionId);
        if (context != null) {
            context.paused = true;
            context.result.setStatus("PAUSED");
        }
    }
    
    public void resumeExecution(String executionId) {
        TestExecutionContext context = executionContexts.get(executionId);
        if (context != null) {
            context.paused = false;
            context.result.setStatus("RUNNING");
            executorService.submit(() -> executeScenarios(context));
        }
    }
    
    private void executeScenarios(TestExecutionContext context) {
        if (context.request.isParallel()) {
            // Parallel execution: scenarios run in parallel
            executeScenariorsParallel(context);
        } else {
            // Sequential execution: all scenarios run sequentially
            executeScenariorsSequential(context);
        }
        
        context.result.setStatus("COMPLETED");
    }
    
    private void executeScenariorsParallel(TestExecutionContext context) {
        List<Future<?>> futures = new ArrayList<>();
        
        // Execute each scenario in parallel
        for (TestExecutionRequest.ScenarioExecution scenario : context.request.getScenarios()) {
            Future<?> future = executorService.submit(() -> executeScenario(context, scenario));
            futures.add(future);
        }
        
        // Wait for all scenarios to complete
        for (Future<?> future : futures) {
            try {
                future.get();
            } catch (Exception e) {
                log.error("Error executing scenario", e);
            }
        }
    }
    
    private void executeScenariorsSequential(TestExecutionContext context) {
        // Execute each scenario sequentially
        for (TestExecutionRequest.ScenarioExecution scenario : context.request.getScenarios()) {
            executeScenario(context, scenario);
        }
    }
    
    private void executeScenario(TestExecutionContext context, TestExecutionRequest.ScenarioExecution scenario) {
        ScenarioResult scenarioResult = new ScenarioResult();
        scenarioResult.setScenarioName(scenario.getScenarioName());
        scenarioResult.setStepResults(new ArrayList<>());
        scenarioResult.setStatus("RUNNING");
        
        synchronized (context.result) {
            context.result.getScenarioResults().add(scenarioResult);
        }
        
        // Execute steps sequentially within a scenario
        for (TestExecutionRequest.StepExecution step : scenario.getSteps()) {
            // Check if paused
            while (context.paused) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
            
            StepResult stepResult = executeStep(step);
            
            synchronized (context.result) {
                scenarioResult.getStepResults().add(stepResult);
                context.result.setCompletedSteps(context.result.getCompletedSteps() + 1);
                
                if ("PASS".equals(stepResult.getStatus())) {
                    context.result.setPassedSteps(context.result.getPassedSteps() + 1);
                } else if ("FAIL".equals(stepResult.getStatus())) {
                    context.result.setFailedSteps(context.result.getFailedSteps() + 1);
                }
            }
        }
        
        scenarioResult.setStatus("COMPLETED");
    }
    
    private StepResult executeStep(TestExecutionRequest.StepExecution step) {
        StepResult result = new StepResult();
        result.setCaseNo(step.getCaseNo());
        result.setPriority(step.getPriority());
        result.setRequestData(step.getRequestData());
        result.setFieldComparisons(new HashMap<>());
        
        long startTime = System.currentTimeMillis();
        result.setExecutionTimestamp(startTime);
        
        try {
            // Send TCP request and get response
            Map<String, String> actualResponse = sendTcpRequest(step.getRequestData());
            
            // Compare expected vs actual
            boolean allMatch = true;
            for (Map.Entry<String, String> expected : step.getExpectedData().entrySet()) {
                String key = expected.getKey();
                String expectedValue = expected.getValue();
                String actualValue = actualResponse.getOrDefault(key, "");
                
                FieldComparison comparison = new FieldComparison();
                comparison.setExpectedValue(expectedValue);
                comparison.setActualValue(actualValue);
                comparison.setMatch(expectedValue.equals(actualValue));
                
                result.getFieldComparisons().put(key, comparison);
                
                if (!comparison.isMatch()) {
                    allMatch = false;
                }
            }
            
            result.setStatus(allMatch ? "PASS" : "FAIL");
            
        } catch (Exception e) {
            log.error("Error executing step", e);
            result.setStatus("FAIL");
            result.setErrorMessage(e.getMessage());
        }
        
        result.setExecutionTime(System.currentTimeMillis() - startTime);
        
        return result;
    }
    
    private Map<String, String> sendTcpRequest(Map<String, String> requestData) throws IOException {
        String cardNo = padRight(requestData.getOrDefault("cardNo", ""), 16);
        String settlementAmount = padRight(requestData.getOrDefault("settlementAmount", ""), 12);
        String requestMethod = padRight(requestData.getOrDefault("requestMethod", ""), 2);
        
        String request = cardNo + settlementAmount + requestMethod;
        byte[] requestBytes = request.getBytes(MS949);
        
        if (requestBytes.length != 30) {
            log.warn("Request byte length is {} instead of 30. Request: {}", requestBytes.length, request);
        }
        
        try (Socket socket = new Socket(TCP_HOST, TCP_PORT);
             OutputStream out = socket.getOutputStream();
             InputStream in = socket.getInputStream()) {
            
            log.debug("Sending request ({} bytes): cardNo={}, amount={}, method={}", 
                requestBytes.length, cardNo.trim(), settlementAmount.trim(), requestMethod.trim());
            
            out.write(requestBytes);
            out.flush();
            
            // Read response: responseCode(4) + approvalNo(12) + responseMessage(20) + discountYn(1) = 37 bytes
            byte[] buffer = new byte[37];
            int bytesRead = in.read(buffer);
            
            if (bytesRead == 37) {
                // Parse by byte array slicing to handle MS949 multi-byte characters correctly
                Map<String, String> result = new HashMap<>();
                result.put("responseCode", new String(buffer, 0, 4, MS949).trim());
                result.put("approvalNo", new String(buffer, 4, 12, MS949).trim());
                result.put("responseMessage", new String(buffer, 16, 20, MS949).trim());
                result.put("discountYn", new String(buffer, 36, 1, MS949).trim());
                
                log.debug("Received response ({} bytes): code={}, approval={}, message={}, discount={}", 
                    bytesRead, result.get("responseCode"), result.get("approvalNo"), 
                    result.get("responseMessage"), result.get("discountYn"));
                
                return result;
            } else {
                throw new IOException("Invalid response length: " + bytesRead);
            }
        }
    }
    
    private String padRight(String s, int byteLength) {
        try {
            byte[] bytes = s.getBytes(MS949);
            
            if (bytes.length >= byteLength) {
                // Truncate to exact byte length
                return new String(bytes, 0, byteLength, MS949);
            }
            
            // Pad with spaces to reach byte length
            byte[] padded = new byte[byteLength];
            System.arraycopy(bytes, 0, padded, 0, bytes.length);
            for (int i = bytes.length; i < byteLength; i++) {
                padded[i] = (byte) ' ';
            }
            return new String(padded, MS949);
        } catch (Exception e) {
            // Fallback to simple padding if error
            StringBuilder sb = new StringBuilder(s);
            while (sb.length() < byteLength) {
                sb.append(' ');
            }
            return sb.toString();
        }
    }
    
    private static class TestExecutionContext {
        String executionId;
        TestExecutionRequest request;
        TestExecutionResult result;
        volatile boolean paused;
    }
}
