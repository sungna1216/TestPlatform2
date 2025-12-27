# 📐 테이블 설계 개요

## 1. ERD (Entity Relationship Diagram)

```
┌─────────────────────────────────────┐
│         TEST_CASE                   │  ← 파일 단위 (test_case_1.txt)
├─────────────────────────────────────┤
│ PK: CASE_ID                         │
│ UK: FILE_NAME                       │
│     TITLE                           │
│     NOTE (CLOB)                     │
│     VERSION_STATUS (DRAFT/PUBLISHED)│
│     VERSION_NUMBER                  │
│     CREATED_AT, UPDATED_AT          │
└───────────────┬─────────────────────┘
                │ 1:N
                ▼
┌─────────────────────────────────────┐
│      TEST_SCENARIO                  │  ← 시나리오 (주유소, E1충전소, ...)
├─────────────────────────────────────┤
│ PK: SCENARIO_ID                     │
│ FK: CASE_ID                         │
│     SCENARIO_NAME                   │
│     SCENARIO_ORDER                  │
│     VERSION_STATUS                  │
└───────────────┬─────────────────────┘
                │ 1:N
                ▼
┌─────────────────────────────────────┐
│         TEST_STEP                   │  ← 스텝 (Request + Expected 쌍)
├─────────────────────────────────────┤
│ PK: STEP_ID                         │
│ FK: SCENARIO_ID                     │
│     CASE_NO (0001, 0002, ...)       │
│     STEP_ORDER                      │
│     PRIORITY (HIGH/MEDIUM/LOW)      │
│     REQUEST_JSON (CLOB) ◀────────── │ 🔑 요청 데이터 JSON
│     EXPECTED_JSON (CLOB) ◀───────── │ 🔑 기대값 데이터 JSON
│     VERSION_STATUS                  │
└─────────────────────────────────────┘


┌─────────────────────────────────────┐
│    TEST_CASE_HISTORY                │  ← 버전 히스토리
├─────────────────────────────────────┤
│ PK: HISTORY_ID                      │
│ FK: CASE_ID                         │
│     VERSION_NUMBER                  │
│     VERSION_TYPE (AUTO/MANUAL/PUBLISH)│
│     SNAPSHOT_JSON (CLOB)            │  ← 전체 스냅샷
│     CREATED_AT, CREATED_BY          │
│     CHANGE_DESCRIPTION              │
└─────────────────────────────────────┘


┌─────────────────────────────────────┐
│   TEST_STEP_CHANGE_LOG              │  ← 상세 변경 로그
├─────────────────────────────────────┤
│ PK: LOG_ID                          │
│ FK: STEP_ID, CASE_ID                │
│     ACTION_TYPE (INSERT/UPDATE/DELETE)│
│     BEFORE_JSON, AFTER_JSON         │
│     CHANGED_FIELDS                  │
└─────────────────────────────────────┘
```

---

## 2. JSON 저장 구조 상세

### 2.1 REQUEST_JSON 예시
```json
{
  "거래방법": "A",
  "requestMethodCode": "",
  "cancelYn": "",
  "원승인번호": "",
  "금액": "10000",
  "카드번호": "1234-5678-****-****"
}
```

### 2.2 EXPECTED_JSON 예시
```json
{
  "응답코드": "0000",
  "응답메시지": "정상처리",
  "거래일시": "20241217123045",
  "승인번호": "12345678"
}
```

### 2.3 txt 파일과의 매핑

**txt 파일 (현재)**:
```
{"주유소":[
  {"caseNo":"0001","거래방법":"A","requestMethodCode":"","priority":"LOW"},
  {"caseNo":"0001","응답코드":"0000","응답메시지":"정상처리","priority":"LOW"},
  ...
]}
```

**DB 저장 (신규)**:
```sql
-- SCENARIO
SCENARIO_ID: 1
SCENARIO_NAME: '주유소'

-- STEP 1
STEP_ID: 1
CASE_NO: '0001'
PRIORITY: 'LOW'
REQUEST_JSON: '{"거래방법":"A","requestMethodCode":""}'
EXPECTED_JSON: '{"응답코드":"0000","응답메시지":"정상처리"}'
```

---

## 3. 버전 관리 시나리오

### 3.1 편집 흐름

```
사용자가 편집 시작
    ↓
┌───────────────────────────────────┐
│ VERSION_STATUS = 'DRAFT'          │  ← 편집 중
│ 실시간 편집                        │
└───────────────────────────────────┘
    ↓ (5분마다 자동)
┌───────────────────────────────────┐
│ AUTO_SAVE                         │  ← 자동 저장
│ TEST_CASE_HISTORY 저장            │
└───────────────────────────────────┘
    ↓ (사용자가 "💾 저장" 클릭)
┌───────────────────────────────────┐
│ MANUAL_SAVE                       │  ← 임시 저장
│ TEST_CASE_HISTORY 저장            │
│ VERSION_STATUS = 'DRAFT'          │  (여전히 DRAFT)
└───────────────────────────────────┘
    ↓ (사용자가 "🚀 최종저장" 클릭)
┌───────────────────────────────────┐
│ PUBLISH                           │  ← 최종 저장
│ TEST_CASE_HISTORY 저장            │
│ VERSION_STATUS = 'PUBLISHED'      │
│ VERSION_NUMBER += 1               │  (버전 증가)
└───────────────────────────────────┘
```

### 3.2 버전 히스토리 예시

```sql
-- test_case_1.txt의 변경 이력
CASE_ID | VERSION_NUM | VERSION_TYPE | CREATED_AT          | DESCRIPTION
--------+-------------+--------------+---------------------+---------------------------
1       | 1           | PUBLISH      | 2024-12-01 10:00:00 | 초기 버전
1       | 1           | AUTO_SAVE    | 2024-12-15 14:05:00 | (자동 저장)
1       | 1           | AUTO_SAVE    | 2024-12-15 14:10:00 | (자동 저장)
1       | 1           | MANUAL_SAVE  | 2024-12-15 14:15:00 | (임시 저장)
1       | 2           | PUBLISH      | 2024-12-15 15:00:00 | E1 충전소 케이스 추가
1       | 2           | AUTO_SAVE    | 2024-12-17 09:05:00 | (자동 저장)
1       | 3           | PUBLISH      | 2024-12-17 10:00:00 | 복합거래 취소 케이스 추가
```

---

## 4. 인덱스 전략

### 4.1 필수 인덱스
```sql
-- 1. 시나리오 조회 (빠른 JOIN)
CREATE INDEX IDX_SCENARIO_CASE ON TEST_SCENARIO(CASE_ID);

-- 2. 스텝 조회 (시나리오별)
CREATE INDEX IDX_STEP_SCENARIO ON TEST_STEP(SCENARIO_ID);

-- 3. 케이스 번호 검색
CREATE INDEX IDX_STEP_CASE_NO ON TEST_STEP(CASE_NO);

-- 4. 버전별 조회
CREATE INDEX IDX_STEP_VERSION ON TEST_STEP(VERSION_STATUS);

-- 5. 히스토리 조회
CREATE INDEX IDX_HISTORY_CASE ON TEST_CASE_HISTORY(CASE_ID);
CREATE INDEX IDX_HISTORY_VERSION ON TEST_CASE_HISTORY(CASE_ID, VERSION_NUMBER);
```

### 4.2 선택적 인덱스 (Oracle JSON 기능)
```sql
-- JSON 필드 검색 최적화 (Oracle 12c+)
CREATE INDEX IDX_REQUEST_TRANSACTION_TYPE 
ON TEST_STEP (JSON_VALUE(REQUEST_JSON, '$.거래방법'));

CREATE INDEX IDX_EXPECTED_RESPONSE_CODE 
ON TEST_STEP (JSON_VALUE(EXPECTED_JSON, '$.응답코드'));
```

---

## 5. 데이터 무결성 규칙

### 5.1 제약 조건
```sql
-- 1. 파일명 중복 방지
ALTER TABLE TEST_CASE ADD CONSTRAINT UK_FILE_NAME UNIQUE (FILE_NAME);

-- 2. 버전 상태 체크
ALTER TABLE TEST_CASE ADD CONSTRAINT CK_VERSION_STATUS 
CHECK (VERSION_STATUS IN ('DRAFT', 'PUBLISHED'));

-- 3. 우선순위 체크
ALTER TABLE TEST_STEP ADD CONSTRAINT CK_PRIORITY 
CHECK (PRIORITY IN ('HIGH', 'MEDIUM', 'LOW', '보통'));

-- 4. CASCADE DELETE (시나리오 삭제 시 스텝도 삭제)
-- 이미 FK 설정에 ON DELETE CASCADE 포함됨
```

### 5.2 비즈니스 규칙
```sql
-- 1. PUBLISHED 버전은 삭제 불가 (Trigger)
CREATE OR REPLACE TRIGGER TRG_PREVENT_DELETE_PUBLISHED
BEFORE DELETE ON TEST_CASE
FOR EACH ROW
BEGIN
    IF :OLD.VERSION_STATUS = 'PUBLISHED' THEN
        RAISE_APPLICATION_ERROR(-20001, '최종 저장된 버전은 삭제할 수 없습니다.');
    END IF;
END;
/

-- 2. 버전 번호는 증가만 가능 (Trigger)
CREATE OR REPLACE TRIGGER TRG_VERSION_INCREMENT_ONLY
BEFORE UPDATE ON TEST_CASE
FOR EACH ROW
BEGIN
    IF :NEW.VERSION_NUMBER < :OLD.VERSION_NUMBER THEN
        RAISE_APPLICATION_ERROR(-20002, '버전 번호는 감소할 수 없습니다.');
    END IF;
END;
/
```

---

## 6. 마이그레이션 우선순위

### 파일별 마이그레이션 순서
```
1. test_case_1.txt (637 bytes)     ← 가장 작은 파일로 테스트
2. test_case_2.txt (221 bytes)     
3. test_case_3.txt (19 KB)         
4. test_case_4.txt (604 KB)        ← 대용량 파일은 마지막
```

### 검증 쿼리
```sql
-- 마이그레이션 완료 확인
SELECT 
    tc.FILE_NAME,
    COUNT(DISTINCT ts.SCENARIO_ID) AS SCENARIO_COUNT,
    COUNT(t.STEP_ID) AS STEP_COUNT
FROM TEST_CASE tc
LEFT JOIN TEST_SCENARIO ts ON tc.CASE_ID = ts.CASE_ID
LEFT JOIN TEST_STEP t ON ts.SCENARIO_ID = t.SCENARIO_ID
GROUP BY tc.FILE_NAME
ORDER BY tc.FILE_NAME;
```

---

## 7. 성능 예측

### 현재 (txt 파일)
```
test_case_4.txt (727 스텝)
- 로딩: 3-5초
- 수정 저장: 3-5초
- 메모리: 전체 파일 로드 필요
```

### 예상 (Oracle DB + 페이징)
```
test_case_4.txt (727 스텝)
- 로딩 (100개): 0.3초
- 1개 수정 저장: 0.05초
- 메모리: 화면에 보이는 데이터만
```

### 페이징 성능
```sql
-- 100개 스텝 조회 (인덱스 사용)
SELECT * FROM (
    SELECT t.*, 
           ROW_NUMBER() OVER (ORDER BY t.STEP_ORDER) AS rn
    FROM TEST_STEP t
    WHERE t.SCENARIO_ID = 1
)
WHERE rn BETWEEN 1 AND 100;

-- 실행 계획: INDEX RANGE SCAN → 0.1초 이내
```

---

## 8. 백업 전략

### 자동 백업
```sql
-- 매일 자동 PUBLISH (스케줄러)
BEGIN
    DBMS_SCHEDULER.CREATE_JOB (
        job_name        => 'DAILY_AUTO_PUBLISH',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'BEGIN PROC_AUTO_SAVE_TEST_CASE(1, ''system''); END;',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=DAILY; BYHOUR=23; BYMINUTE=59',
        enabled         => TRUE
    );
END;
/
```

### Export 백업
```bash
# Oracle Data Pump로 전체 백업
expdp userid=system/password \
  schemas=TESTUSER \
  directory=BACKUP_DIR \
  dumpfile=testcase_backup_%U.dmp \
  logfile=testcase_backup.log

# txt 파일로 백업 (Git 관리용)
# Java ExportService 실행
```

---

## 9. 추가 개선 아이디어

### 9.1 성능 개선
- **Materialized View**: 자주 조회하는 통계 데이터 캐싱
- **Partitioning**: VERSION_NUMBER 기준으로 파티셔닝
- **Read Replica**: 조회 전용 DB 분리

### 9.2 기능 개선
- **Diff 기능**: 버전 간 차이점 시각화
- **Comment**: 스텝별 코멘트 추가
- **Tag**: 스텝에 태그 기능 (예: #결제, #취소)
- **Search**: 전문 검색 (Oracle Text)

### 9.3 협업 기능
- **Lock**: 동시 편집 방지
- **Branch**: Git처럼 브랜치 기능
- **Merge**: 변경사항 병합
- **Review**: 변경 승인 워크플로우
