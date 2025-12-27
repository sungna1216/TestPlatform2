# 🚀 Oracle DB 마이그레이션 가이드

## 📋 준비사항

### 1. Oracle DB 실행 확인
```bash
# Docker Oracle 상태 확인
docker ps | grep oracle

# SQL*Plus 접속 테스트
sqlplus app_user/app_pass@localhost:1521/XEPDB1
```

### 2. 스키마 생성
```bash
# schema_optimized.sql 실행
sqlplus app_user/app_pass@localhost:1521/XEPDB1 @db/schema_optimized.sql

# 또는 간단한 schema.sql 실행
sqlplus app_user/app_pass@localhost:1521/XEPDB1 @db/schema.sql
```

### 3. Maven 의존성 다운로드
```bash
cd /Users/haesung/Desktop/dev/CascadeProjects/NewAutoTest-main
mvn clean install
```

---

## 🎯 실행 방법

### Step 1: 애플리케이션 시작
```bash
mvn spring-boot:run
```

### Step 2: 마이그레이션 페이지 접속
브라우저에서 다음 URL 접속:
```
http://localhost:8080/migration
```

### Step 3: 마이그레이션 실행

#### 옵션 A: 전체 마이그레이션 (권장)
1. "🚀 전체 마이그레이션" 버튼 클릭
2. 확인 후 대기
3. 로그에서 진행 상황 확인

#### 옵션 B: 단일 파일 마이그레이션
1. "📄 단일 파일 마이그레이션" 버튼 클릭
2. 파일명 입력 (예: `test_case_1.txt`)
3. 확인

---

## 📊 마이그레이션 결과 확인

### 방법 1: 웹 UI
```
http://localhost:8080/migration/stats
```

### 방법 2: SQL 쿼리
```sql
-- 케이스 개수
SELECT COUNT(*) FROM TEST_CASE;

-- 시나리오 개수
SELECT COUNT(*) FROM TEST_SCENARIO;

-- 스텝 개수
SELECT COUNT(*) FROM TEST_STEP;

-- 특정 케이스 조회
SELECT tc.FILE_NAME, tc.TITLE, 
       COUNT(DISTINCT ts.SCENARIO_ID) AS SCENARIOS,
       COUNT(t.STEP_ID) AS STEPS
FROM TEST_CASE tc
LEFT JOIN TEST_SCENARIO ts ON tc.CASE_ID = ts.CASE_ID
LEFT JOIN TEST_STEP t ON ts.SCENARIO_ID = t.SCENARIO_ID
WHERE tc.FILE_NAME = 'test_case_1.txt'
GROUP BY tc.FILE_NAME, tc.TITLE;
```

---

## 🔍 검색 테스트

### 거래방법으로 검색
```sql
-- 인덱스 사용 확인 (EXPLAIN PLAN)
EXPLAIN PLAN FOR
SELECT * FROM TEST_STEP
WHERE TRANSACTION_TYPE = 'A'
  AND VERSION_STATUS = 'PUBLISHED';

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
-- 결과: INDEX RANGE SCAN (IDX_STEP_TRANSACTION)
```

### 응답코드로 검색
```sql
SELECT tc.FILE_NAME, ts.SCENARIO_NAME, t.CASE_NO, t.EXPECTED_JSON
FROM TEST_STEP t
JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
WHERE t.EXPECTED_RESPONSE_CODE = '0000'
  AND tc.VERSION_STATUS = 'PUBLISHED'
FETCH FIRST 100 ROWS ONLY;
```

### 복합 조건 검색
```sql
SELECT * FROM TEST_STEP
WHERE TRANSACTION_TYPE = 'A'
  AND EXPECTED_RESPONSE_CODE = '0000'
  AND PRIORITY = 'HIGH'
FETCH FIRST 100 ROWS ONLY;
```

---

## ⚡ 성능 확인

### 1. 인덱스 사용 확인
```sql
-- 인덱스 목록
SELECT INDEX_NAME, TABLESPACE_NAME, STATUS
FROM USER_INDEXES
WHERE TABLE_NAME IN ('TEST_CASE', 'TEST_SCENARIO', 'TEST_STEP')
ORDER BY TABLE_NAME, INDEX_NAME;

-- 인덱스 통계
SELECT INDEX_NAME, NUM_ROWS, DISTINCT_KEYS, CLUSTERING_FACTOR
FROM USER_INDEXES
WHERE TABLE_NAME = 'TEST_STEP';
```

### 2. 쿼리 실행 계획 확인
```sql
-- 실행 계획 생성
EXPLAIN PLAN FOR
SELECT * FROM TEST_STEP
WHERE TRANSACTION_TYPE = 'A';

-- 실행 계획 조회
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

### 3. 통계 수집 (성능 최적화)
```sql
BEGIN
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'TEST_CASE');
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'TEST_SCENARIO');
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'TEST_STEP');
END;
/
```

---

## 🐛 트러블슈팅

### 문제 1: Oracle 접속 실패
```
Error: ORA-12154: TNS:could not resolve the connect identifier
```

**해결**:
```bash
# Oracle 컨테이너 확인
docker ps

# 포트 확인
docker port <oracle-container-id>

# application.properties 확인
spring.datasource.url=jdbc:oracle:thin:@localhost:1521/XEPDB1
```

### 문제 2: Sequence 오류
```
Error: ORA-02289: sequence does not exist
```

**해결**:
```sql
-- Sequence 생성 확인
SELECT SEQUENCE_NAME FROM USER_SEQUENCES;

-- 없으면 schema.sql 재실행
@db/schema_optimized.sql
```

### 문제 3: JSON 파싱 오류
```
Error: Unexpected character at line 1
```

**해결**:
- txt 파일의 JSON 형식 확인
- 쉼표(,) 누락 확인
- 중괄호({}) 짝 맞는지 확인

### 문제 4: 중복 데이터
```
Error: unique constraint violated
```

**해결**:
```sql
-- 기존 데이터 삭제
DELETE FROM TEST_STEP WHERE VERSION_STATUS = 'DRAFT';
DELETE FROM TEST_SCENARIO WHERE VERSION_STATUS = 'DRAFT';
DELETE FROM TEST_CASE WHERE FILE_NAME = 'test_case_1.txt';
COMMIT;
```

---

## 📈 대용량 데이터 처리

### 7만개 케이스 마이그레이션
```java
// MigrationService.java에서 배치 크기 조정
spring.jpa.properties.hibernate.jdbc.batch_size=1000

// 병렬 처리 (추후 구현)
// @Async를 사용한 멀티스레드 마이그레이션
```

### 예상 소요 시간
| 케이스 수 | 스텝 수 | 예상 시간 | 방법 |
|---------|--------|----------|------|
| 100 | 500 | 1분 | 단일 스레드 |
| 1,000 | 5,000 | 5분 | 단일 스레드 |
| 10,000 | 50,000 | 30분 | 배치 처리 |
| 70,000 | 350,000 | 2시간 | 배치 처리 |

---

## 🔄 롤백 방법

### 특정 케이스만 삭제
```bash
# REST API 사용
curl -X DELETE "http://localhost:8080/migration/case?fileName=test_case_1.txt"
```

### 전체 데이터 삭제
```bash
# ⚠️ 주의: 모든 데이터가 삭제됩니다!
curl -X DELETE "http://localhost:8080/migration/all"
```

### SQL로 직접 삭제
```sql
-- 특정 케이스 삭제 (CASCADE로 시나리오/스텝도 삭제)
DELETE FROM TEST_CASE WHERE FILE_NAME = 'test_case_1.txt';
COMMIT;

-- 전체 삭제
DELETE FROM TEST_STEP;
DELETE FROM TEST_SCENARIO;
DELETE FROM TEST_CASE;
COMMIT;
```

---

## 📝 다음 단계

마이그레이션이 완료되면:

1. **기존 Controller 수정**: txt 파일 대신 DB 조회
2. **검색 기능 구현**: `/api/search` 엔드포인트
3. **버전 관리 구현**: 자동저장, 임시저장, 최종저장
4. **페이징 적용**: 100개씩 로딩
5. **성능 모니터링**: 느린 쿼리 추적

---

## 🎯 목표 성능

| 작업 | 목표 | 현재 방식 (txt) |
|------|------|----------------|
| 100개 스텝 로딩 | < 0.3초 | 3-5초 |
| 거래방법=A 검색 | < 0.1초 | 불가능 |
| 1개 스텝 수정 | < 0.05초 | 3-5초 |
| 페이지 이동 | < 0.1초 | 3-5초 |

---

## 📞 지원

문제 발생 시:
1. 로그 확인: `logs/spring.log`
2. Oracle 로그 확인: Docker logs
3. 마이그레이션 페이지의 로그 콘솔 확인

---

## ✅ 체크리스트

- [ ] Oracle DB 실행 중
- [ ] schema_optimized.sql 실행 완료
- [ ] Maven 의존성 다운로드 완료
- [ ] application.properties 설정 확인
- [ ] 애플리케이션 정상 시작
- [ ] 마이그레이션 페이지 접속 가능
- [ ] 전체 마이그레이션 성공
- [ ] 통계 확인 (케이스/시나리오/스텝 개수)
- [ ] 검색 쿼리 테스트
- [ ] 인덱스 사용 확인
