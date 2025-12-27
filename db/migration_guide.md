# 📦 txt 파일 → Oracle DB 마이그레이션 가이드

## 1. 테이블 구조 설명

### 📊 데이터 계층
```
TEST_CASE (파일)
  └── TEST_SCENARIO (시나리오)
        └── TEST_STEP (스텝: Request + Expected)
```

### 🔄 버전 관리 흐름
```
1. 편집 중 (DRAFT)
   ↓ (5분마다 자동저장)
2. AUTO_SAVE → TEST_CASE_HISTORY
   ↓ (사용자가 "임시저장" 클릭)
3. MANUAL_SAVE → TEST_CASE_HISTORY
   ↓ (사용자가 "최종저장" 클릭)
4. PUBLISHED (VERSION_NUMBER 증가)
   └── PUBLISH → TEST_CASE_HISTORY
```

---

## 2. JSON 저장 방식

### ✅ 추천 방식: CLOB에 JSON 저장

**장점**:
- ✅ txt 파일 구조 그대로 유지
- ✅ 마이그레이션 스크립트 단순화
- ✅ 유연성: 새 필드 추가 시 스키마 변경 불필요
- ✅ txt 파일 export 쉬움

**단점**:
- ⚠️ JSON 내부 필드로 검색 시 성능 저하 (Oracle JSON 인덱스로 해결 가능)

### 현재 txt 파일 구조
```
{"주유소":[
  {"caseNo":"0001","거래방법":"A","requestMethodCode":"","priority":"LOW"},
  {"caseNo":"0001","응답코드":"0000","priority":"LOW"},
  ...
]}
```

### DB 저장 방식
```sql
-- STEP 1 저장
REQUEST_JSON:  '{"거래방법":"A","requestMethodCode":""}'
EXPECTED_JSON: '{"응답코드":"0000"}'
CASE_NO: '0001'
PRIORITY: 'LOW'
```

---

## 3. 마이그레이션 전략

### 옵션 A: Java 코드로 마이그레이션 (추천)
기존 `TestCaseFileParser`를 활용하여 DB INSERT

```java
@Service
public class MigrationService {
    public void migrateTxtFileToDb(String fileName) {
        // 1. 기존 파서로 파일 읽기
        Path path = Paths.get("output", fileName);
        String title = TestCaseFileParser.extractTitle(path);
        String note = TestCaseFileParser.extractNote(path);
        List<TestScenario> scenarios = TestCaseFileParser.parseTestCaseFile(path);
        
        // 2. TEST_CASE 생성
        TestCase testCase = new TestCase();
        testCase.setFileName(fileName);
        testCase.setTitle(title);
        testCase.setNote(note);
        testCase.setVersionStatus("PUBLISHED");
        testCaseRepository.save(testCase);
        
        // 3. SCENARIO & STEP 생성
        for (int i = 0; i < scenarios.size(); i++) {
            TestScenario scenario = scenarios.get(i);
            
            TestScenarioEntity scenarioEntity = new TestScenarioEntity();
            scenarioEntity.setTestCase(testCase);
            scenarioEntity.setScenarioName(scenario.getScenarioName());
            scenarioEntity.setScenarioOrder(i + 1);
            scenarioRepository.save(scenarioEntity);
            
            for (int j = 0; j < scenario.getSteps().size(); j++) {
                TestStep step = scenario.getSteps().get(j);
                
                // Request JSON 생성
                Map<String, String> requestMap = new LinkedHashMap<>();
                for (int k = 0; k < step.getKeys().size(); k++) {
                    requestMap.put(step.getKeys().get(k), step.getValues().get(k));
                }
                
                // Expected JSON 생성
                Map<String, String> expectedMap = new LinkedHashMap<>();
                for (int k = 0; k < step.getExpectedKeys().size(); k++) {
                    expectedMap.put(step.getExpectedKeys().get(k), step.getExpectedValues().get(k));
                }
                
                TestStepEntity stepEntity = new TestStepEntity();
                stepEntity.setScenario(scenarioEntity);
                stepEntity.setCaseNo(step.getCaseNo());
                stepEntity.setPriority(step.getPriority());
                stepEntity.setRequestJson(objectMapper.writeValueAsString(requestMap));
                stepEntity.setExpectedJson(objectMapper.writeValueAsString(expectedMap));
                stepEntity.setStepOrder(j + 1);
                stepRepository.save(stepEntity);
            }
        }
    }
}
```

### 옵션 B: SQL*Loader 사용
CSV로 변환 후 bulk insert (대용량 데이터에 유리)

---

## 4. Oracle JSON 기능 활용 (선택)

### JSON 필드 검색 최적화
```sql
-- JSON 컬럼에 인덱스 생성 (Oracle 12c+)
CREATE INDEX IDX_STEP_REQUEST_JSON 
ON TEST_STEP (JSON_VALUE(REQUEST_JSON, '$.거래방법'));

-- JSON 필드로 검색
SELECT * FROM TEST_STEP
WHERE JSON_VALUE(REQUEST_JSON, '$.거래방법') = 'A';

-- JSON 필드 업데이트
UPDATE TEST_STEP
SET REQUEST_JSON = JSON_MERGEPATCH(REQUEST_JSON, '{"거래방법":"B"}')
WHERE STEP_ID = 123;
```

---

## 5. 버전 관리 사용 예시

### 시나리오 1: 편집 중 자동 저장
```sql
-- 프론트엔드에서 5분마다 호출
EXEC PROC_AUTO_SAVE_TEST_CASE(p_case_id => 1, p_user => 'user123');
```

### 시나리오 2: 사용자가 임시 저장
```sql
-- "💾 저장" 버튼 클릭 시
UPDATE TEST_CASE 
SET UPDATED_AT = CURRENT_TIMESTAMP,
    UPDATED_BY = 'user123'
WHERE CASE_ID = 1;

-- 히스토리 저장
INSERT INTO TEST_CASE_HISTORY (...)
VALUES (..., 'MANUAL_SAVE', ...);
```

### 시나리오 3: 최종 저장 (배포)
```sql
-- "🚀 최종 저장" 버튼 클릭 시
EXEC PROC_PUBLISH_TEST_CASE(
    p_case_id => 1, 
    p_user => 'user123',
    p_description => 'E1 충전소 케이스 추가'
);

-- 결과: VERSION_NUMBER가 1 → 2로 증가, STATUS가 PUBLISHED로 변경
```

### 시나리오 4: 과거 버전 복원
```sql
-- 버전 2로 롤백
DECLARE
    v_snapshot CLOB;
BEGIN
    -- 버전 2의 스냅샷 가져오기
    SELECT SNAPSHOT_JSON INTO v_snapshot
    FROM TEST_CASE_HISTORY
    WHERE CASE_ID = 1 AND VERSION_NUMBER = 2;
    
    -- 스냅샷을 파싱하여 현재 테이블에 복원
    -- (Java 코드에서 처리)
END;
/
```

---

## 6. 성능 최적화 팁

### 대용량 데이터 조회 (페이지네이션)
```sql
-- 페이지 1 (1~100번째 스텝)
SELECT * FROM (
    SELECT t.*, ROW_NUMBER() OVER (ORDER BY STEP_ORDER) AS rn
    FROM TEST_STEP t
    WHERE SCENARIO_ID = 1
)
WHERE rn BETWEEN 1 AND 100;
```

### 변경된 스텝만 UPDATE
```java
// Java에서 dirty checking
@Transactional
public void updateStep(Long stepId, String newRequestJson) {
    TestStepEntity step = stepRepository.findById(stepId).orElseThrow();
    
    // 변경 전 데이터 로깅
    String beforeJson = step.getRequestJson();
    
    // 업데이트
    step.setRequestJson(newRequestJson);
    step.setUpdatedAt(LocalDateTime.now());
    
    // 변경 로그 저장
    TestStepChangeLog log = new TestStepChangeLog();
    log.setStepId(stepId);
    log.setActionType("UPDATE");
    log.setBeforeJson(beforeJson);
    log.setAfterJson(newRequestJson);
    changeLogRepository.save(log);
}
```

---

## 7. txt 파일 Export (백업/Git 관리)

### DB → txt 파일 생성
```java
@Service
public class ExportService {
    public void exportDbToTextFile(Long caseId) {
        TestCase testCase = testCaseRepository.findById(caseId);
        List<TestScenarioEntity> scenarios = scenarioRepository.findByCaseIdOrderByScenarioOrder(caseId);
        
        List<String> lines = new ArrayList<>();
        lines.add("1.TEST CASE NAME : " + testCase.getTitle());
        lines.add("2.NOTE");
        lines.add(testCase.getNote());
        
        for (TestScenarioEntity scenario : scenarios) {
            lines.add("TEST CASE START : " + scenario.getScenarioName());
            lines.add("{\"" + scenario.getScenarioName() + "\":[");
            
            List<TestStepEntity> steps = stepRepository.findByScenarioIdOrderByStepOrder(scenario.getScenarioId());
            for (int i = 0; i < steps.size(); i++) {
                TestStepEntity step = steps.get(i);
                
                // Request JSON에 caseNo, priority 추가
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> request = mapper.readValue(step.getRequestJson(), Map.class);
                request.put("caseNo", step.getCaseNo());
                request.put("priority", step.getPriority());
                
                Map<String, Object> expected = mapper.readValue(step.getExpectedJson(), Map.class);
                expected.put("caseNo", step.getCaseNo());
                expected.put("priority", step.getPriority());
                
                lines.add("  " + mapper.writeValueAsString(request) + ",");
                lines.add("  " + mapper.writeValueAsString(expected) + (i < steps.size() - 1 ? "," : ""));
            }
            
            lines.add("]}");
        }
        
        lines.add("TEST CASE END");
        
        Files.write(Paths.get("output", testCase.getFileName()), lines, StandardCharsets.UTF_8);
    }
}
```

---

## 8. 마이그레이션 체크리스트

- [ ] Oracle Docker 컨테이너 실행 확인
- [ ] schema.sql 실행하여 테이블 생성
- [ ] 기존 txt 파일 백업
- [ ] output/ 디렉토리의 모든 txt 파일 목록 확인
- [ ] MigrationService 구현
- [ ] test_case_1.txt 테스트 마이그레이션
- [ ] 마이그레이션 결과 검증 (DB 조회)
- [ ] 전체 파일 마이그레이션
- [ ] Export 기능 테스트 (DB → txt 재생성)
- [ ] 성능 테스트 (test_case_4.txt 로딩 시간)

---

## 9. 다음 단계

1. **pom.xml 수정**: Oracle JDBC, JPA 의존성 추가
2. **application.properties 설정**: Oracle DB 연결 정보
3. **Entity 클래스 생성**: @Entity 어노테이션
4. **Repository 인터페이스**: JpaRepository 상속
5. **MigrationService 구현**: txt → DB
6. **Controller 수정**: 파일 대신 DB 조회/수정
7. **버전 관리 API**: 자동저장, 임시저장, 최종저장
8. **프론트엔드 수정**: 페이지네이션, 자동저장 타이머
