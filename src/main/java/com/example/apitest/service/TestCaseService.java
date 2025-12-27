package com.example.apitest.service;

import com.example.apitest.entity.TestCaseEntity;
import com.example.apitest.entity.TestScenarioEntity;
import com.example.apitest.entity.TestStepEntity;
import com.example.apitest.model.TestForm;
import com.example.apitest.model.TestScenario;
import com.example.apitest.model.TestStep;
import com.example.apitest.repository.TestCaseRepository;
import com.example.apitest.repository.TestScenarioRepository;
import com.example.apitest.repository.TestStepRepository;
import com.example.apitest.util.TestCaseFileWriter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TestCaseService {
    
    private final TestCaseRepository testCaseRepository;
    private final TestScenarioRepository testScenarioRepository;
    private final TestStepRepository testStepRepository;
    private final ObjectMapper objectMapper;
    
    @Value("${app.backup.txt.enabled:true}")
    private boolean txtBackupEnabled;
    
    /**
     * 모든 테스트 케이스 조회 (페이징)
     */
    public Page<TestCaseEntity> getAllCases(Pageable pageable) {
        return testCaseRepository.findAll(pageable);
    }
    
    /**
     * 특정 테스트 케이스 조회 (Scenarios + Steps 포함)
     */
    @Transactional(readOnly = true)
    public TestCaseEntity getCaseWithDetails(Long caseId) {
        TestCaseEntity testCase = testCaseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));
        
        // Lazy loading 방지 - 명시적 로딩
        testCase.getScenarios().size();
        testCase.getScenarios().forEach(scenario -> scenario.getSteps().size());
        
        return testCase;
    }
    
    /**
     * 테스트 케이스를 TestForm으로 변환
     */
    @Transactional(readOnly = true)
    public TestForm getCaseAsForm(Long caseId) {
        TestCaseEntity entity = getCaseWithDetails(caseId);
        
        TestForm form = new TestForm();
        form.setTitle(entity.getTitle());
        form.setNote(entity.getNote());
        
        List<TestScenario> scenarios = entity.getScenarios().stream()
                .map(this::convertScenarioEntityToModel)
                .collect(Collectors.toList());
        form.setScenarios(scenarios);
        
        return form;
    }
    
    /**
     * 테스트 케이스 생성
     */
    @Transactional
    public TestCaseEntity createCase(TestForm form) {
        // 1. TestCase 저장
        TestCaseEntity testCase = TestCaseEntity.builder()
                .title(form.getTitle())
                .note(form.getNote())
                .fileName("test_case_auto_" + System.currentTimeMillis() + ".txt")
                .category("기타")
                .versionStatus("DRAFT")
                .versionNumber(1)
                .isActive("Y")
                .createdBy("system")
                .updatedBy("system")
                .build();
        
        testCase = testCaseRepository.save(testCase);
        
        // 2. Scenarios + Steps 저장
        saveScenariosAndSteps(testCase, form.getScenarios());
        
        // 3. txt 백업 (옵션)
        if (txtBackupEnabled) {
            backupToTxtFile(testCase.getCaseId(), form);
        }
        
        log.info("Created test case: {} (ID: {})", testCase.getTitle(), testCase.getCaseId());
        return testCase;
    }
    
    /**
     * 테스트 케이스 업데이트
     */
    @Transactional
    public TestCaseEntity updateCase(Long caseId, TestForm form) {
        // 1. 기존 케이스 조회
        TestCaseEntity testCase = testCaseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));
        
        // 2. 메타데이터 업데이트
        testCase.setTitle(form.getTitle());
        testCase.setNote(form.getNote());
        testCase.setUpdatedAt(LocalDateTime.now());
        testCase.setUpdatedBy("system");
        
        // 3. 기존 Scenarios + Steps 삭제
        testScenarioRepository.deleteAll(testCase.getScenarios());
        testCase.getScenarios().clear();
        
        // 4. 새 Scenarios + Steps 저장
        saveScenariosAndSteps(testCase, form.getScenarios());
        
        // 5. txt 백업 (옵션)
        if (txtBackupEnabled) {
            backupToTxtFile(caseId, form);
        }
        
        log.info("Updated test case: {} (ID: {})", testCase.getTitle(), caseId);
        return testCase;
    }
    
    /**
     * 테스트 케이스 삭제
     */
    @Transactional
    public void deleteCase(Long caseId) {
        testCaseRepository.deleteById(caseId);
        log.info("Deleted test case ID: {}", caseId);
    }
    
    /**
     * Scenarios + Steps 저장 (헬퍼)
     */
    private void saveScenariosAndSteps(TestCaseEntity testCase, List<TestScenario> scenarios) {
        if (scenarios == null) return;
        
        int scenarioOrder = 0;
        for (TestScenario scenarioModel : scenarios) {
            // Scenario 저장
            TestScenarioEntity scenario = TestScenarioEntity.builder()
                    .testCase(testCase)
                    .scenarioName(scenarioModel.getScenarioName())
                    .scenarioOrder(scenarioOrder++)
                    .build();
            scenario = testScenarioRepository.save(scenario);
            
            // Steps 저장
            if (scenarioModel.getSteps() != null) {
                int stepOrder = 0;
                for (TestStep stepModel : scenarioModel.getSteps()) {
                    TestStepEntity step = TestStepEntity.builder()
                            .scenario(scenario)
                            .caseNo(stepModel.getCaseNo())
                            .stepOrder(stepOrder++)
                            .priority(stepModel.getPriority() != null ? stepModel.getPriority() : "보통")
                            .requestJson(convertToJson(stepModel.getKeys(), stepModel.getValues()))
                            .expectedJson(convertToJson(stepModel.getExpectedKeys(), stepModel.getExpectedValues()))
                            .versionStatus("DRAFT")
                            .build();
                    testStepRepository.save(step);
                }
            }
        }
    }
    
    /**
     * Entity → Model 변환 (헬퍼)
     */
    private TestScenario convertScenarioEntityToModel(TestScenarioEntity entity) {
        TestScenario model = new TestScenario();
        model.setScenarioName(entity.getScenarioName());
        
        List<TestStep> steps = entity.getSteps().stream()
                .map(this::convertStepEntityToModel)
                .collect(Collectors.toList());
        model.setSteps(steps);
        
        return model;
    }
    
    private TestStep convertStepEntityToModel(TestStepEntity entity) {
        TestStep model = new TestStep();
        model.setCaseNo(entity.getCaseNo());
        model.setPriority(entity.getPriority());
        
        try {
            // JSON → Map 파싱
            if (entity.getRequestJson() != null) {
                java.util.Map<String, Object> requestMap = objectMapper.readValue(entity.getRequestJson(), 
                        objectMapper.getTypeFactory().constructMapType(java.util.Map.class, String.class, Object.class));
                model.setKeys(new ArrayList<>(requestMap.keySet()));
                // Object를 String으로 변환
                List<String> requestValues = new ArrayList<>();
                for (Object val : requestMap.values()) {
                    requestValues.add(val != null ? val.toString() : "");
                }
                model.setValues(requestValues);
            }
            
            if (entity.getExpectedJson() != null) {
                java.util.Map<String, Object> expectedMap = objectMapper.readValue(entity.getExpectedJson(), 
                        objectMapper.getTypeFactory().constructMapType(java.util.Map.class, String.class, Object.class));
                model.setExpectedKeys(new ArrayList<>(expectedMap.keySet()));
                // Object를 String으로 변환
                List<String> expectedValues = new ArrayList<>();
                for (Object val : expectedMap.values()) {
                    expectedValues.add(val != null ? val.toString() : "");
                }
                model.setExpectedValues(expectedValues);
            }
        } catch (Exception e) {
            log.error("Failed to parse JSON for step ID: {}", entity.getStepId(), e);
        }
        
        return model;
    }
    
    /**
     * List<String> keys + values → JSON 변환 (헬퍼)
     */
    private String convertToJson(List<String> keys, List<String> values) {
        if (keys == null || values == null) return "{}";
        
        try {
            java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
            for (int i = 0; i < Math.min(keys.size(), values.size()); i++) {
                map.put(keys.get(i), values.get(i));
            }
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            log.error("Failed to convert to JSON", e);
            return "{}";
        }
    }
    
    /**
     * txt 파일 백업 (옵션)
     */
    private void backupToTxtFile(Long caseId, TestForm form) {
        try {
            String fileName = "test_case_" + caseId + ".txt";
            TestCaseFileWriter.writeTestCaseFile(form, fileName);
            log.info("Backed up to txt file: {}", fileName);
        } catch (Exception e) {
            log.warn("Failed to backup to txt file for case ID: {}", caseId, e);
            // 백업 실패는 무시 (DB가 주력이므로)
        }
    }
    
    /**
     * 카테고리별 조회
     */
    public List<TestCaseEntity> getCasesByCategory(String category) {
        return testCaseRepository.findByCategory(category, org.springframework.data.domain.PageRequest.of(0, 1000)).getContent();
    }
    
    /**
     * 모든 카테고리 목록
     */
    public List<String> getAllCategories() {
        return testCaseRepository.findAllCategories();
    }
}
