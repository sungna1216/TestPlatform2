package com.example.apitest.service;

import com.example.apitest.entity.TestCaseEntity;
import com.example.apitest.entity.TestScenarioEntity;
import com.example.apitest.entity.TestStepEntity;
import com.example.apitest.model.TestScenario;
import com.example.apitest.model.TestStep;
import com.example.apitest.repository.TestCaseRepository;
import com.example.apitest.repository.TestScenarioRepository;
import com.example.apitest.repository.TestStepRepository;
import com.example.apitest.util.TestCaseFileParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MigrationService {
    
    private final TestCaseRepository testCaseRepository;
    private final TestScenarioRepository testScenarioRepository;
    private final TestStepRepository testStepRepository;
    private final ObjectMapper objectMapper;
    
    private static final String OUTPUT_DIR = "output";
    
    /**
     * 단일 txt 파일을 DB로 마이그레이션
     */
    @Transactional
    public void migrateSingleFile(String fileName) throws IOException {
        log.info("🚀 마이그레이션 시작: {}", fileName);
        long startTime = System.currentTimeMillis();
        
        Path filePath = Paths.get(OUTPUT_DIR, fileName);
        if (!Files.exists(filePath)) {
            throw new IOException("파일을 찾을 수 없습니다: " + fileName);
        }
        
        // 1. 기존 데이터 확인
        Optional<TestCaseEntity> existingCase = testCaseRepository.findByFileName(fileName);
        if (existingCase.isPresent()) {
            log.warn("⚠️ 이미 존재하는 케이스입니다. 스킵: {}", fileName);
            return;
        }
        
        // 2. txt 파일 파싱
        String title = TestCaseFileParser.extractTitle(filePath);
        String note = TestCaseFileParser.extractNote(filePath);
        List<TestScenario> scenarios = TestCaseFileParser.parseTestCaseFile(filePath);
        
        log.info("📄 파일 파싱 완료: 시나리오 {}개", scenarios.size());
        
        // 3. TestCase 엔티티 생성
        TestCaseEntity testCase = TestCaseEntity.builder()
                .fileName(fileName)
                .title(title)
                .note(note)
                .versionStatus("PUBLISHED")  // 기존 파일은 PUBLISHED로 저장
                .versionNumber(1)
                .category(extractCategory(title))
                .isActive("Y")
                .build();
        
        // 4. Scenario와 Step 생성
        int scenarioOrder = 1;
        int totalSteps = 0;
        
        for (TestScenario scenario : scenarios) {
            TestScenarioEntity scenarioEntity = TestScenarioEntity.builder()
                    .scenarioName(scenario.getScenarioName())
                    .scenarioOrder(scenarioOrder++)
                    .versionStatus("PUBLISHED")
                    .build();
            
            testCase.addScenario(scenarioEntity);
            
            // Step 생성
            int stepOrder = 1;
            for (TestStep step : scenario.getSteps()) {
                TestStepEntity stepEntity = createStepEntity(step, stepOrder++);
                scenarioEntity.addStep(stepEntity);
                totalSteps++;
            }
        }
        
        // 5. DB 저장
        testCaseRepository.save(testCase);
        
        long duration = System.currentTimeMillis() - startTime;
        log.info("✅ 마이그레이션 완료: {} (시나리오: {}, 스텝: {}, 소요시간: {}ms)", 
                fileName, scenarios.size(), totalSteps, duration);
    }
    
    /**
     * 전체 txt 파일 마이그레이션 (배치)
     */
    @Transactional
    public Map<String, String> migrateAllFiles() {
        log.info("🚀 전체 파일 마이그레이션 시작");
        long startTime = System.currentTimeMillis();
        
        Map<String, String> results = new LinkedHashMap<>();
        
        try {
            Path outputDir = Paths.get(OUTPUT_DIR);
            if (!Files.exists(outputDir)) {
                log.error("❌ output 디렉토리가 없습니다: {}", OUTPUT_DIR);
                return results;
            }
            
            // txt 파일 목록 조회
            List<String> txtFiles = Files.list(outputDir)
                    .filter(f -> f.getFileName().toString().startsWith("test_case_"))
                    .filter(f -> f.toString().endsWith(".txt"))
                    .map(f -> f.getFileName().toString())
                    .sorted()
                    .collect(Collectors.toList());
            
            log.info("📁 발견된 파일: {}개", txtFiles.size());
            
            // 파일별 마이그레이션
            int success = 0;
            int failed = 0;
            
            for (String fileName : txtFiles) {
                try {
                    migrateSingleFile(fileName);
                    results.put(fileName, "SUCCESS");
                    success++;
                } catch (Exception e) {
                    log.error("❌ 마이그레이션 실패: {} - {}", fileName, e.getMessage());
                    results.put(fileName, "FAILED: " + e.getMessage());
                    failed++;
                }
            }
            
            long duration = System.currentTimeMillis() - startTime;
            log.info("✅ 전체 마이그레이션 완료: 성공 {}, 실패 {}, 소요시간: {}ms", 
                    success, failed, duration);
            
        } catch (IOException e) {
            log.error("❌ 파일 목록 조회 실패", e);
        }
        
        return results;
    }
    
    /**
     * TestStep 엔티티 생성
     */
    private TestStepEntity createStepEntity(TestStep step, int stepOrder) {
        try {
            // Request JSON 생성
            Map<String, Object> requestMap = new LinkedHashMap<>();
            if (step.getKeys() != null && step.getValues() != null) {
                for (int i = 0; i < step.getKeys().size(); i++) {
                    if (i < step.getValues().size()) {
                        requestMap.put(step.getKeys().get(i), step.getValues().get(i));
                    }
                }
            }
            
            // Expected JSON 생성
            Map<String, Object> expectedMap = new LinkedHashMap<>();
            if (step.getExpectedKeys() != null && step.getExpectedValues() != null) {
                for (int i = 0; i < step.getExpectedKeys().size(); i++) {
                    if (i < step.getExpectedValues().size()) {
                        expectedMap.put(step.getExpectedKeys().get(i), step.getExpectedValues().get(i));
                    }
                }
            }
            
            String requestJson = objectMapper.writeValueAsString(requestMap);
            String expectedJson = objectMapper.writeValueAsString(expectedMap);
            
            TestStepEntity stepEntity = TestStepEntity.builder()
                    .caseNo(step.getCaseNo())
                    .stepOrder(stepOrder)
                    .priority(step.getPriority() != null ? step.getPriority() : "보통")
                    .requestJson(requestJson)
                    .expectedJson(expectedJson)
                    .versionStatus("PUBLISHED")
                    .build();
            
            // extractSearchableFields()는 @PrePersist에서 자동 호출됨
            
            return stepEntity;
            
        } catch (Exception e) {
            log.error("❌ Step 생성 실패: caseNo={}", step.getCaseNo(), e);
            throw new RuntimeException("Step 생성 실패", e);
        }
    }
    
    /**
     * 제목에서 카테고리 추출 (휴리스틱)
     */
    private String extractCategory(String title) {
        if (title == null) return null;
        
        String lowerTitle = title.toLowerCase();
        if (lowerTitle.contains("주유소") || lowerTitle.contains("gas")) {
            return "주유소";
        } else if (lowerTitle.contains("충전소") || lowerTitle.contains("e1") || lowerTitle.contains("ev")) {
            return "충전소";
        } else if (lowerTitle.contains("편의점") || lowerTitle.contains("cvs")) {
            return "편의점";
        } else if (lowerTitle.contains("결제") || lowerTitle.contains("payment")) {
            return "결제";
        }
        return "기타";
    }
    
    /**
     * 마이그레이션 통계 조회
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getMigrationStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        
        long totalCases = testCaseRepository.count();
        long totalScenarios = testScenarioRepository.count();
        long totalSteps = testStepRepository.count();
        
        stats.put("totalCases", totalCases);
        stats.put("totalScenarios", totalScenarios);
        stats.put("totalSteps", totalSteps);
        stats.put("avgStepsPerCase", totalCases > 0 ? totalSteps / totalCases : 0);
        
        // 카테고리별 통계
        List<String> categories = testCaseRepository.findAllCategories();
        Map<String, Long> categoryCounts = new LinkedHashMap<>();
        for (String category : categories) {
            long count = testCaseRepository.findByCategory(category, null).getTotalElements();
            categoryCounts.put(category, count);
        }
        stats.put("categories", categoryCounts);
        
        return stats;
    }
    
    /**
     * 특정 케이스 삭제 (롤백용)
     */
    @Transactional
    public void deleteCase(String fileName) {
        Optional<TestCaseEntity> testCase = testCaseRepository.findByFileName(fileName);
        if (testCase.isPresent()) {
            testCaseRepository.delete(testCase.get());
            log.info("🗑️ 케이스 삭제: {}", fileName);
        } else {
            log.warn("⚠️ 삭제할 케이스를 찾을 수 없습니다: {}", fileName);
        }
    }
    
    /**
     * 전체 데이터 삭제 (주의!)
     */
    @Transactional
    public void deleteAllData() {
        log.warn("⚠️ 전체 데이터 삭제 시작");
        testStepRepository.deleteAll();
        testScenarioRepository.deleteAll();
        testCaseRepository.deleteAll();
        log.info("✅ 전체 데이터 삭제 완료");
    }
}
