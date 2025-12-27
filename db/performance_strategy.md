# 🚀 70,000+ 테스트 케이스 성능 최적화 전략

## 1. 문제 정의

### 현재 상황
- **테스트 케이스 수**: 70,000+
- **예상 스텝 수**: 350,000+ (케이스당 평균 5개 스텝)
- **단순 CLOB JSON 저장 시 문제**:
  ```sql
  -- ❌ Full Table Scan (70만 행 스캔)
  SELECT * FROM TEST_STEP
  WHERE JSON_VALUE(REQUEST_JSON, '$.거래방법') = 'A';
  -- 예상 소요 시간: 30초 ~ 1분
  ```

---

## 2. 하이브리드 아키텍처 설계

### 2.1 데이터 저장 전략

```
┌─────────────────────────────────────────────────────┐
│              TEST_STEP 테이블                        │
├─────────────────────────────────────────────────────┤
│ 정규화 컬럼 (자주 검색)        │  JSON 컬럼 (유연성)  │
├──────────────────────────────┼──────────────────────┤
│ TRANSACTION_TYPE VARCHAR(50) │  REQUEST_JSON CLOB  │  ← 거래방법: "A"
│ EXPECTED_RESPONSE_CODE       │  EXPECTED_JSON CLOB │  ← 응답코드: "0000"
│ CANCEL_YN CHAR(1)            │                     │  ← 취소여부: "Y"
│ AMOUNT NUMBER(15,2)          │                     │  ← 금액: 10000
│ PRIORITY VARCHAR(20)         │                     │
└──────────────────────────────┴──────────────────────┘
         ↓                              ↓
    인덱스 사용 가능              나머지 필드는 JSON
    (B-Tree Index)               (동적 필드 지원)
```

### 2.2 검색 성능 비교

| 검색 방식 | Full Scan | Index Scan | 소요 시간 (70만 행) |
|----------|-----------|------------|-------------------|
| JSON 함수 검색 | ✅ | ❌ | 30초 ~ 1분 |
| 정규화 컬럼 검색 | ❌ | ✅ | 0.01초 ~ 0.1초 |
| 역인덱스 검색 | ❌ | ✅ | 0.1초 ~ 0.5초 |

---

## 3. 검색 최적화 기법

### 3.1 자주 검색되는 필드 → 정규화 컬럼

**마이그레이션 시 JSON에서 추출**:
```java
// TestStep 저장 시 자동 추출
@PrePersist
@PreUpdate
public void extractSearchableFields() {
    try {
        ObjectMapper mapper = new ObjectMapper();
        
        // REQUEST_JSON 파싱
        Map<String, Object> request = mapper.readValue(this.requestJson, Map.class);
        this.transactionType = (String) request.get("거래방법");
        this.cancelYn = (String) request.get("cancelYn");
        this.amount = parseAmount(request.get("금액"));
        
        // EXPECTED_JSON 파싱
        Map<String, Object> expected = mapper.readValue(this.expectedJson, Map.class);
        this.expectedResponseCode = (String) expected.get("응답코드");
        this.expectedResponseMsg = (String) expected.get("응답메시지");
        
    } catch (Exception e) {
        // JSON 파싱 실패 시 null 유지
    }
}
```

**검색 쿼리**:
```sql
-- ✅ 인덱스 사용 (0.1초 이내)
SELECT tc.FILE_NAME, ts.SCENARIO_NAME, t.CASE_NO
FROM TEST_STEP t
USE INDEX (IDX_STEP_TRANSACTION)
JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
WHERE t.TRANSACTION_TYPE = 'A'
  AND t.EXPECTED_RESPONSE_CODE = '0000'
  AND tc.VERSION_STATUS = 'PUBLISHED';

-- 실행 계획:
-- 1. INDEX RANGE SCAN: IDX_STEP_SEARCH_COMBO
-- 2. TABLE ACCESS BY INDEX ROWID
-- 3. NESTED LOOPS (테이블 조인)
-- 예상 행: 1,000 / 총 행: 700,000 (0.14% 스캔)
```

---

### 3.2 역인덱스 테이블 (동적 필드 검색)

**구조**:
```
TEST_SEARCH_INDEX 테이블
┌──────────┬─────────┬────────────┬──────────────┬────────┐
│ STEP_ID  │ CASE_ID │ FIELD_NAME │ FIELD_VALUE  │ SOURCE │
├──────────┼─────────┼────────────┼──────────────┼────────┤
│ 100001   │ 1       │ 거래방법    │ A            │ REQUEST│
│ 100001   │ 1       │ 금액       │ 10000        │ REQUEST│
│ 100001   │ 1       │ 응답코드    │ 0000         │ EXPECTED│
│ 100002   │ 1       │ 거래방법    │ I            │ REQUEST│
│ 100002   │ 1       │ 응답코드    │ 7834         │ EXPECTED│
└──────────┴─────────┴────────────┴──────────────┴────────┘
                        ↓
            복합 인덱스: (FIELD_NAME, FIELD_VALUE)
```

**사용 시나리오**: 정규화하지 않은 필드 검색
```sql
-- 예: "원승인번호 = '12345678'" 검색
SELECT DISTINCT tc.FILE_NAME, t.CASE_NO, t.REQUEST_JSON
FROM TEST_SEARCH_INDEX si
USE INDEX (IDX_SEARCH_FIELD_VALUE)
JOIN TEST_STEP t ON si.STEP_ID = t.STEP_ID
JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
WHERE si.FIELD_NAME = '원승인번호'
  AND si.FIELD_VALUE = '12345678';

-- 실행 계획:
-- 1. INDEX RANGE SCAN: IDX_SEARCH_FIELD_VALUE (원승인번호, 12345678)
-- 2. 매칭되는 STEP_ID만 조회
-- 예상 스캔: 10~100 행 / 총 역인덱스: 3,500,000 행
```

**자동 업데이트**:
```sql
-- TRIGGER로 자동 관리 (schema_optimized.sql 참고)
-- INSERT/UPDATE 시 자동으로 역인덱스 생성
```

---

### 3.3 파티셔닝 (시간별 분리)

**월별 자동 파티셔닝**:
```sql
-- 2024년 1월 데이터
ALTER TABLE TEST_CASE PARTITION P_2024_01;

-- 2024년 12월 데이터만 조회 (Partition Pruning)
SELECT * FROM TEST_CASE
WHERE PARTITION_DATE >= TO_DATE('2024-12-01', 'YYYY-MM-DD')
  AND PARTITION_DATE < TO_DATE('2025-01-01', 'YYYY-MM-DD');

-- 실행 계획: PARTITION RANGE SINGLE (1개 파티션만 스캔)
```

**효과**:
- 전체 70,000 케이스 중 최근 1개월(5,000 케이스)만 스캔
- I/O 93% 감소

---

### 3.4 Materialized View (집계 성능)

**대시보드용 통계**:
```sql
-- 카테고리별 통계 (실시간 계산 X)
SELECT CATEGORY, COUNT(*) AS TOTAL_CASES, SUM(TOTAL_STEPS) AS TOTAL_STEPS
FROM MV_CASE_STATISTICS
WHERE VERSION_STATUS = 'PUBLISHED'
GROUP BY CATEGORY;

-- 실행 시간: 0.01초 (사전 계산됨)
```

**일반 쿼리와 비교**:
```sql
-- ❌ 일반 쿼리 (매번 계산)
SELECT tc.CATEGORY, COUNT(*), SUM(...)
FROM TEST_CASE tc
JOIN TEST_SCENARIO ts ON ...
JOIN TEST_STEP t ON ...
GROUP BY tc.CATEGORY;
-- 실행 시간: 5~10초 (70만 행 조인)

-- ✅ Materialized View
SELECT * FROM MV_CASE_STATISTICS;
-- 실행 시간: 0.01초
```

---

## 4. 검색 시나리오별 전략

### 시나리오 1: 단일 필드 검색
**예**: "거래방법 = 'A'인 모든 케이스"

```java
// JPA Repository
@Query("""
    SELECT t FROM TestStep t
    JOIN FETCH t.scenario s
    JOIN FETCH s.testCase c
    WHERE t.transactionType = :type
      AND c.versionStatus = 'PUBLISHED'
    ORDER BY t.stepId
""")
Page<TestStep> findByTransactionType(
    @Param("type") String type, 
    Pageable pageable
);

// 사용
Page<TestStep> results = repository.findByTransactionType("A", 
    PageRequest.of(0, 100));
```

**성능**:
- 인덱스: `IDX_STEP_TRANSACTION`
- 예상 시간: 0.05초
- 스캔 행: 1,000~5,000 (전체 70만 중)

---

### 시나리오 2: 복합 조건 검색
**예**: "거래방법 = 'A' AND 응답코드 = '0000' AND 우선순위 = 'HIGH'"

```sql
-- 복합 인덱스 활용
SELECT /*+ INDEX(t IDX_STEP_SEARCH_COMBO) */ 
    tc.FILE_NAME, t.CASE_NO, t.REQUEST_JSON
FROM TEST_STEP t
JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
WHERE t.TRANSACTION_TYPE = 'A'
  AND t.EXPECTED_RESPONSE_CODE = '0000'
  AND t.PRIORITY = 'HIGH'
  AND tc.VERSION_STATUS = 'PUBLISHED';

-- 복합 인덱스: (TRANSACTION_TYPE, EXPECTED_RESPONSE_CODE, VERSION_STATUS)
-- 예상 시간: 0.1초
```

---

### 시나리오 3: 동적 필드 검색 (역인덱스)
**예**: "카드번호 = '1234****'"

```java
// Service
public List<TestStepDto> searchByDynamicField(String fieldName, String fieldValue) {
    return jdbcTemplate.query("""
        SELECT DISTINCT t.STEP_ID, t.CASE_NO, t.REQUEST_JSON, t.EXPECTED_JSON
        FROM TEST_SEARCH_INDEX si
        JOIN TEST_STEP t ON si.STEP_ID = t.STEP_ID
        WHERE si.FIELD_NAME = ?
          AND si.FIELD_VALUE LIKE ?
        ORDER BY t.STEP_ID
        FETCH FIRST 100 ROWS ONLY
    """, new Object[]{fieldName, fieldValue + "%"}, rowMapper);
}

// 호출
searchByDynamicField("카드번호", "1234");
```

**성능**:
- 인덱스: `IDX_SEARCH_FIELD_VALUE`
- 예상 시간: 0.2초

---

### 시나리오 4: 전문 검색 (Oracle Text)
**예**: "정상처리" 키워드로 전체 검색

```sql
-- Oracle Text 인덱스 활용
SELECT c.FILE_NAME, f.SEARCHABLE_TEXT
FROM TEST_FULLTEXT_SEARCH f
JOIN TEST_CASE c ON f.CASE_ID = c.CASE_ID
WHERE CONTAINS(f.SEARCHABLE_TEXT, '정상처리') > 0;

-- 예상 시간: 0.5초
```

---

## 5. 페이징 전략

### 5.1 오프셋 페이징 (작은 페이지 번호)
```sql
-- 1~100번째 행
SELECT * FROM (
    SELECT t.*, ROW_NUMBER() OVER (ORDER BY t.STEP_ID) AS rn
    FROM TEST_STEP t
    WHERE t.TRANSACTION_TYPE = 'A'
)
WHERE rn BETWEEN 1 AND 100;
-- 성능: 양호 (0.1초)
```

### 5.2 커서 페이징 (큰 페이지 번호)
```sql
-- STEP_ID > 마지막ID 방식
SELECT * FROM TEST_STEP
WHERE TRANSACTION_TYPE = 'A'
  AND STEP_ID > :lastStepId
ORDER BY STEP_ID
FETCH FIRST 100 ROWS ONLY;
-- 성능: 우수 (0.05초, 페이지 번호 무관)
```

---

## 6. 인덱스 전략 요약

### 필수 인덱스 (7개)
```sql
1. IDX_STEP_SCENARIO (SCENARIO_ID, STEP_ORDER)         -- 시나리오별 조회
2. IDX_STEP_CASE_NO (CASE_NO)                          -- 케이스 번호 검색
3. IDX_STEP_TRANSACTION (TRANSACTION_TYPE, VERSION_STATUS)  -- 거래방법
4. IDX_STEP_RESPONSE_CODE (EXPECTED_RESPONSE_CODE)     -- 응답코드
5. IDX_STEP_SEARCH_COMBO (TRANSACTION_TYPE, EXPECTED_RESPONSE_CODE, VERSION_STATUS)
6. IDX_SEARCH_FIELD_VALUE (FIELD_NAME, FIELD_VALUE)    -- 역인덱스
7. UK_CASE_FILE_NAME (FILE_NAME)                       -- 파일명 유니크
```

### 선택적 인덱스
```sql
-- 금액 범위 검색이 필요한 경우
CREATE INDEX IDX_STEP_AMOUNT ON TEST_STEP(AMOUNT) WHERE AMOUNT IS NOT NULL;

-- 날짜 범위 검색
CREATE INDEX IDX_CASE_UPDATED ON TEST_CASE(UPDATED_AT DESC);
```

---

## 7. 마이그레이션 성능

### 7.1 예상 소요 시간

| 단계 | 행 수 | 예상 시간 | 방법 |
|------|-------|----------|------|
| TEST_CASE | 70,000 | 5분 | Batch Insert (1000건씩) |
| TEST_SCENARIO | 350,000 | 20분 | Batch Insert |
| TEST_STEP | 700,000 | 40분 | Batch Insert + JSON 파싱 |
| TEST_SEARCH_INDEX | 3,500,000 | 60분 | Trigger 자동 생성 |
| **총합** | - | **2시간** | - |

### 7.2 병렬 마이그레이션

```java
@Service
public class ParallelMigrationService {
    
    @Async
    public CompletableFuture<Void> migrateFile(String fileName) {
        // 파일별 독립적으로 마이그레이션
        List<TestScenario> scenarios = parser.parse(fileName);
        
        // Batch Insert (1000건씩)
        for (int i = 0; i < scenarios.size(); i += 1000) {
            List<TestScenario> batch = scenarios.subList(i, 
                Math.min(i + 1000, scenarios.size()));
            repository.saveAll(batch);
        }
        
        return CompletableFuture.completedFuture(null);
    }
    
    public void migrateAllFiles() {
        List<String> files = getTextFiles();
        
        // 10개 파일씩 병렬 처리
        List<CompletableFuture<Void>> futures = files.stream()
            .map(this::migrateFile)
            .collect(Collectors.toList());
        
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    }
}
```

**예상 시간**: 2시간 → **30분** (4배 속도)

---

## 8. 모니터링 및 최적화

### 8.1 느린 쿼리 감지
```sql
-- 1초 이상 걸린 검색 추적
SELECT * FROM V_SLOW_SEARCHES
ORDER BY AVG_TIME_MS DESC;

-- 결과 예시:
-- KEYWORD          | TYPE          | AVG_TIME_MS | COUNT
-- '원승인번호=123' | FIELD_SEARCH  | 2500        | 50
-- 'A AND 0000'     | COMPLEX       | 1800        | 120
```

### 8.2 인덱스 사용률 확인
```sql
-- 사용되지 않는 인덱스 확인
SELECT INDEX_NAME, NUM_ROWS, LAST_USED
FROM USER_INDEXES
WHERE TABLE_NAME = 'TEST_STEP'
  AND LAST_USED IS NULL;
```

### 8.3 통계 자동 수집
```sql
-- 매일 밤 2시 통계 갱신
BEGIN
    DBMS_SCHEDULER.CREATE_JOB (
        job_name => 'DAILY_STATS_GATHER',
        job_type => 'PLSQL_BLOCK',
        job_action => 'BEGIN DBMS_STATS.GATHER_SCHEMA_STATS(USER); END;',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=DAILY; BYHOUR=2',
        enabled => TRUE
    );
END;
/
```

---

## 9. 성능 목표

| 작업 | 목표 시간 | 방법 |
|------|----------|------|
| 단일 필드 검색 | < 0.1초 | 정규화 컬럼 + 인덱스 |
| 복합 조건 검색 | < 0.5초 | 복합 인덱스 |
| 동적 필드 검색 | < 1초 | 역인덱스 테이블 |
| 페이지 로딩 (100개) | < 0.3초 | 페이징 + 인덱스 |
| 단일 스텝 수정 | < 0.05초 | UPDATE 1 row |
| 대시보드 통계 | < 0.01초 | Materialized View |

---

## 10. 체크리스트

### 마이그레이션 전
- [ ] Oracle 버전 확인 (12c 이상 권장)
- [ ] JSON 지원 확인 (`JSON_VALUE`, `JSON_OBJECT_T`)
- [ ] 테이블스페이스 용량 확인 (최소 10GB)
- [ ] 병렬 처리 설정 (`PARALLEL_DEGREE`)

### 마이그레이션 후
- [ ] 인덱스 생성 확인 (15개)
- [ ] 통계 수집 완료
- [ ] 샘플 검색 쿼리 실행 (성능 테스트)
- [ ] Materialized View Refresh 확인
- [ ] 느린 쿼리 모니터링 설정

### 운영 중
- [ ] 주간 통계 수집 스케줄러 동작 확인
- [ ] 파티션 자동 생성 확인 (매월 1일)
- [ ] 역인덱스 Trigger 동작 확인
- [ ] 검색 로그 분석 (V_POPULAR_SEARCHES)
