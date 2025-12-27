-- ========================================
-- Oracle DB 스키마 설계 (대용량 70,000+ 케이스 최적화)
-- Full Scan 방지 + 고속 검색 + 버전 관리
-- ========================================

-- ========================================
-- 1. 핵심 데이터 테이블 (정규화 + 검색 최적화)
-- ========================================

-- 1-1. 테스트 케이스 (파일 단위) - 파티셔닝 적용
CREATE TABLE TEST_CASE (
    CASE_ID NUMBER PRIMARY KEY,
    FILE_NAME VARCHAR2(255) NOT NULL,
    TITLE VARCHAR2(500) NOT NULL,
    NOTE CLOB,
    VERSION_STATUS VARCHAR2(20) DEFAULT 'DRAFT',  -- DRAFT, PUBLISHED
    VERSION_NUMBER NUMBER DEFAULT 1,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CREATED_BY VARCHAR2(100) DEFAULT 'system',
    UPDATED_BY VARCHAR2(100) DEFAULT 'system',
    -- 🔍 검색 최적화 필드
    TAGS VARCHAR2(500),                            -- 태그 (쉼표 구분: "결제,취소,IC")
    CATEGORY VARCHAR2(100),                        -- 카테고리 (주유소, 충전소, 편의점)
    IS_ACTIVE CHAR(1) DEFAULT 'Y',                 -- 활성화 여부
    LAST_RUN_AT TIMESTAMP,                         -- 마지막 실행 시간
    -- 파티셔닝 키
    PARTITION_DATE DATE DEFAULT TRUNC(SYSDATE)
)
PARTITION BY RANGE (PARTITION_DATE) 
INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))            -- 월별 자동 파티셔닝
(
    PARTITION P_INITIAL VALUES LESS THAN (TO_DATE('2024-01-01', 'YYYY-MM-DD'))
);

CREATE SEQUENCE SEQ_TEST_CASE START WITH 1 INCREMENT BY 1 CACHE 100;

-- 인덱스
CREATE UNIQUE INDEX UK_CASE_FILE_NAME ON TEST_CASE(FILE_NAME);
CREATE INDEX IDX_CASE_STATUS ON TEST_CASE(VERSION_STATUS, IS_ACTIVE);
CREATE INDEX IDX_CASE_CATEGORY ON TEST_CASE(CATEGORY, VERSION_STATUS);
CREATE INDEX IDX_CASE_UPDATED ON TEST_CASE(UPDATED_AT DESC);
CREATE INDEX IDX_CASE_TAGS ON TEST_CASE(TAGS);  -- 태그 검색용

COMMENT ON TABLE TEST_CASE IS '테스트 케이스 메타 정보 (월별 파티셔닝)';


-- 1-2. 테스트 시나리오
CREATE TABLE TEST_SCENARIO (
    SCENARIO_ID NUMBER PRIMARY KEY,
    CASE_ID NUMBER NOT NULL,
    SCENARIO_NAME VARCHAR2(500) NOT NULL,
    SCENARIO_ORDER NUMBER NOT NULL,
    VERSION_STATUS VARCHAR2(20) DEFAULT 'DRAFT',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_SCENARIO_CASE FOREIGN KEY (CASE_ID) REFERENCES TEST_CASE(CASE_ID) ON DELETE CASCADE
);

CREATE SEQUENCE SEQ_TEST_SCENARIO START WITH 1 INCREMENT BY 1 CACHE 100;
CREATE INDEX IDX_SCENARIO_CASE ON TEST_SCENARIO(CASE_ID, SCENARIO_ORDER);
CREATE INDEX IDX_SCENARIO_NAME ON TEST_SCENARIO(SCENARIO_NAME);


-- 1-3. 테스트 스텝 (하이브리드 구조: 자주 검색하는 필드 + JSON)
CREATE TABLE TEST_STEP (
    STEP_ID NUMBER PRIMARY KEY,
    SCENARIO_ID NUMBER NOT NULL,
    CASE_NO VARCHAR2(10) NOT NULL,
    STEP_ORDER NUMBER NOT NULL,
    PRIORITY VARCHAR2(20) DEFAULT '보통',
    
    -- 📌 JSON 저장 (유연성 유지)
    REQUEST_JSON CLOB NOT NULL,
    EXPECTED_JSON CLOB NOT NULL,
    
    -- 🔍 검색용 정규화 필드 (자주 검색되는 항목만 추출)
    TRANSACTION_TYPE VARCHAR2(50),                 -- 거래방법 (A, I, M, @)
    REQUEST_METHOD VARCHAR2(50),                   -- requestMethodCode
    CANCEL_YN CHAR(1),                             -- 취소 여부
    EXPECTED_RESPONSE_CODE VARCHAR2(10),           -- 응답코드 (0000, 7834 등)
    EXPECTED_RESPONSE_MSG VARCHAR2(200),           -- 응답메시지
    AMOUNT NUMBER(15,2),                           -- 금액 (숫자 검색용)
    
    VERSION_STATUS VARCHAR2(20) DEFAULT 'DRAFT',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT FK_STEP_SCENARIO FOREIGN KEY (SCENARIO_ID) REFERENCES TEST_SCENARIO(SCENARIO_ID) ON DELETE CASCADE
);

CREATE SEQUENCE SEQ_TEST_STEP START WITH 1 INCREMENT BY 1 CACHE 1000;

-- 인덱스 전략 (검색 성능 최적화)
CREATE INDEX IDX_STEP_SCENARIO ON TEST_STEP(SCENARIO_ID, STEP_ORDER);
CREATE INDEX IDX_STEP_CASE_NO ON TEST_STEP(CASE_NO);
CREATE INDEX IDX_STEP_PRIORITY ON TEST_STEP(PRIORITY, VERSION_STATUS);

-- 🚀 고속 검색 인덱스
CREATE INDEX IDX_STEP_TRANSACTION ON TEST_STEP(TRANSACTION_TYPE, VERSION_STATUS);
CREATE INDEX IDX_STEP_RESPONSE_CODE ON TEST_STEP(EXPECTED_RESPONSE_CODE);
CREATE INDEX IDX_STEP_CANCEL ON TEST_STEP(CANCEL_YN, VERSION_STATUS);
CREATE INDEX IDX_STEP_AMOUNT ON TEST_STEP(AMOUNT) WHERE AMOUNT IS NOT NULL;

-- 복합 인덱스 (자주 함께 검색되는 조건)
CREATE INDEX IDX_STEP_SEARCH_COMBO ON TEST_STEP(TRANSACTION_TYPE, EXPECTED_RESPONSE_CODE, VERSION_STATUS);

COMMENT ON TABLE TEST_STEP IS '테스트 스텝 (하이브리드: 정규화 + JSON)';
COMMENT ON COLUMN TEST_STEP.TRANSACTION_TYPE IS 'REQUEST_JSON에서 추출된 거래방법 (검색 최적화)';
COMMENT ON COLUMN TEST_STEP.EXPECTED_RESPONSE_CODE IS 'EXPECTED_JSON에서 추출된 응답코드 (검색 최적화)';


-- ========================================
-- 2. 검색 전용 테이블 (Materialized View 대신)
-- ========================================

-- 2-1. 검색 인덱스 테이블 (역인덱싱)
CREATE TABLE TEST_SEARCH_INDEX (
    INDEX_ID NUMBER PRIMARY KEY,
    STEP_ID NUMBER NOT NULL,
    CASE_ID NUMBER NOT NULL,
    FIELD_NAME VARCHAR2(100) NOT NULL,             -- 필드명 (거래방법, 응답코드, ...)
    FIELD_VALUE VARCHAR2(1000) NOT NULL,           -- 필드값
    VALUE_TYPE VARCHAR2(20),                       -- STRING, NUMBER, DATE
    SOURCE_TYPE VARCHAR2(20),                      -- REQUEST, EXPECTED
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_SEARCH_STEP FOREIGN KEY (STEP_ID) REFERENCES TEST_STEP(STEP_ID) ON DELETE CASCADE
);

CREATE SEQUENCE SEQ_TEST_SEARCH_INDEX START WITH 1 INCREMENT BY 1 CACHE 1000;

-- 역인덱스 (필드명+값 조합으로 빠른 검색)
CREATE INDEX IDX_SEARCH_FIELD_VALUE ON TEST_SEARCH_INDEX(FIELD_NAME, FIELD_VALUE);
CREATE INDEX IDX_SEARCH_VALUE ON TEST_SEARCH_INDEX(FIELD_VALUE);
CREATE INDEX IDX_SEARCH_CASE ON TEST_SEARCH_INDEX(CASE_ID);
CREATE INDEX IDX_SEARCH_STEP ON TEST_SEARCH_INDEX(STEP_ID);

COMMENT ON TABLE TEST_SEARCH_INDEX IS '검색 최적화용 역인덱스 테이블';
COMMENT ON COLUMN TEST_SEARCH_INDEX.FIELD_NAME IS 'JSON 내 필드명 (거래방법, 응답코드 등)';
COMMENT ON COLUMN TEST_SEARCH_INDEX.FIELD_VALUE IS '실제 값 (A, 0000 등)';


-- 2-2. 전문 검색 테이블 (Oracle Text)
CREATE TABLE TEST_FULLTEXT_SEARCH (
    SEARCH_ID NUMBER PRIMARY KEY,
    CASE_ID NUMBER NOT NULL,
    STEP_ID NUMBER,
    SEARCHABLE_TEXT CLOB,                          -- 전체 텍스트 합침
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_FULLTEXT_CASE FOREIGN KEY (CASE_ID) REFERENCES TEST_CASE(CASE_ID) ON DELETE CASCADE
);

CREATE SEQUENCE SEQ_TEST_FULLTEXT START WITH 1 INCREMENT BY 1 CACHE 100;

-- Oracle Text 인덱스 (전문 검색용)
-- CREATE INDEX IDX_FULLTEXT ON TEST_FULLTEXT_SEARCH(SEARCHABLE_TEXT) INDEXTYPE IS CTXSYS.CONTEXT;

COMMENT ON TABLE TEST_FULLTEXT_SEARCH IS '전문 검색용 테이블 (Oracle Text)';


-- ========================================
-- 3. 버전 관리 테이블 (파티셔닝 적용)
-- ========================================

-- 3-1. 버전 히스토리 (날짜별 파티셔닝)
CREATE TABLE TEST_CASE_HISTORY (
    HISTORY_ID NUMBER PRIMARY KEY,
    CASE_ID NUMBER NOT NULL,
    FILE_NAME VARCHAR2(255) NOT NULL,
    TITLE VARCHAR2(500) NOT NULL,
    NOTE CLOB,
    VERSION_NUMBER NUMBER NOT NULL,
    VERSION_TYPE VARCHAR2(20) NOT NULL,
    SNAPSHOT_JSON CLOB NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CREATED_BY VARCHAR2(100) DEFAULT 'system',
    CHANGE_DESCRIPTION VARCHAR2(1000),
    -- 파티셔닝 키
    PARTITION_DATE DATE DEFAULT TRUNC(SYSDATE)
)
PARTITION BY RANGE (PARTITION_DATE)
INTERVAL (NUMTOYMINTERVAL(3, 'MONTH'))            -- 3개월별 파티셔닝
(
    PARTITION P_HISTORY_INITIAL VALUES LESS THAN (TO_DATE('2024-01-01', 'YYYY-MM-DD'))
);

CREATE SEQUENCE SEQ_TEST_CASE_HISTORY START WITH 1 INCREMENT BY 1 CACHE 100;
CREATE INDEX IDX_HISTORY_CASE ON TEST_CASE_HISTORY(CASE_ID, CREATED_AT DESC);
CREATE INDEX IDX_HISTORY_VERSION ON TEST_CASE_HISTORY(CASE_ID, VERSION_NUMBER);


-- 3-2. 스텝 변경 추적 (압축 저장)
CREATE TABLE TEST_STEP_CHANGE_LOG (
    LOG_ID NUMBER PRIMARY KEY,
    STEP_ID NUMBER,
    CASE_ID NUMBER NOT NULL,
    ACTION_TYPE VARCHAR2(20) NOT NULL,
    BEFORE_JSON CLOB,
    AFTER_JSON CLOB,
    CHANGED_FIELDS VARCHAR2(1000),
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CREATED_BY VARCHAR2(100) DEFAULT 'system'
)
COMPRESS FOR OLTP;                                 -- 압축 저장으로 공간 절약

CREATE SEQUENCE SEQ_TEST_STEP_CHANGE_LOG START WITH 1 INCREMENT BY 1 CACHE 100;
CREATE INDEX IDX_CHANGE_LOG_STEP ON TEST_STEP_CHANGE_LOG(STEP_ID);
CREATE INDEX IDX_CHANGE_LOG_CASE ON TEST_STEP_CHANGE_LOG(CASE_ID, CREATED_AT DESC);


-- ========================================
-- 4. 통계 및 집계 테이블 (실시간 대시보드용)
-- ========================================

-- 4-1. 케이스별 통계 (Materialized View)
CREATE MATERIALIZED VIEW MV_CASE_STATISTICS
BUILD IMMEDIATE
REFRESH FAST ON COMMIT
AS
SELECT 
    tc.CASE_ID,
    tc.FILE_NAME,
    tc.TITLE,
    tc.CATEGORY,
    tc.VERSION_STATUS,
    COUNT(DISTINCT ts.SCENARIO_ID) AS SCENARIO_COUNT,
    COUNT(t.STEP_ID) AS TOTAL_STEPS,
    SUM(CASE WHEN t.PRIORITY = 'HIGH' THEN 1 ELSE 0 END) AS HIGH_PRIORITY_COUNT,
    MAX(t.UPDATED_AT) AS LAST_UPDATED
FROM TEST_CASE tc
LEFT JOIN TEST_SCENARIO ts ON tc.CASE_ID = ts.CASE_ID
LEFT JOIN TEST_STEP t ON ts.SCENARIO_ID = t.SCENARIO_ID
GROUP BY tc.CASE_ID, tc.FILE_NAME, tc.TITLE, tc.CATEGORY, tc.VERSION_STATUS;

CREATE INDEX IDX_MV_CASE_STATUS ON MV_CASE_STATISTICS(VERSION_STATUS);
CREATE INDEX IDX_MV_CASE_CATEGORY ON MV_CASE_STATISTICS(CATEGORY);

COMMENT ON MATERIALIZED VIEW MV_CASE_STATISTICS IS '케이스별 통계 (빠른 대시보드 조회)';


-- 4-2. 검색 빈도 추적 (인기 검색어)
CREATE TABLE TEST_SEARCH_LOG (
    LOG_ID NUMBER PRIMARY KEY,
    SEARCH_KEYWORD VARCHAR2(500),
    SEARCH_TYPE VARCHAR2(50),                      -- FIELD_SEARCH, FULLTEXT, CASE_NO
    RESULT_COUNT NUMBER,
    EXECUTION_TIME_MS NUMBER,
    USER_ID VARCHAR2(100),
    SEARCHED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE SEQ_TEST_SEARCH_LOG START WITH 1 INCREMENT BY 1 CACHE 100;
CREATE INDEX IDX_SEARCH_LOG_KEYWORD ON TEST_SEARCH_LOG(SEARCH_KEYWORD);
CREATE INDEX IDX_SEARCH_LOG_DATE ON TEST_SEARCH_LOG(SEARCHED_AT);


-- ========================================
-- 5. 고속 검색을 위한 프로시저
-- ========================================

-- 5-1. 필드값으로 검색 (역인덱스 활용)
CREATE OR REPLACE PROCEDURE PROC_SEARCH_BY_FIELD (
    p_field_name IN VARCHAR2,
    p_field_value IN VARCHAR2,
    p_version_status IN VARCHAR2 DEFAULT 'PUBLISHED',
    p_result OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_result FOR
        SELECT DISTINCT
            tc.CASE_ID,
            tc.FILE_NAME,
            tc.TITLE,
            ts.SCENARIO_NAME,
            t.CASE_NO,
            t.STEP_ORDER,
            t.REQUEST_JSON,
            t.EXPECTED_JSON
        FROM TEST_SEARCH_INDEX si
        JOIN TEST_STEP t ON si.STEP_ID = t.STEP_ID
        JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
        JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
        WHERE si.FIELD_NAME = p_field_name
          AND si.FIELD_VALUE = p_field_value
          AND tc.VERSION_STATUS = p_version_status
        ORDER BY tc.CASE_ID, t.STEP_ORDER;
END;
/


-- 5-2. 복합 조건 검색 (정규화 필드 활용)
CREATE OR REPLACE PROCEDURE PROC_SEARCH_ADVANCED (
    p_transaction_type IN VARCHAR2 DEFAULT NULL,
    p_response_code IN VARCHAR2 DEFAULT NULL,
    p_priority IN VARCHAR2 DEFAULT NULL,
    p_category IN VARCHAR2 DEFAULT NULL,
    p_page IN NUMBER DEFAULT 1,
    p_page_size IN NUMBER DEFAULT 100,
    p_result OUT SYS_REFCURSOR,
    p_total_count OUT NUMBER
) AS
    v_offset NUMBER := (p_page - 1) * p_page_size;
BEGIN
    -- 총 개수 계산
    SELECT COUNT(DISTINCT t.STEP_ID)
    INTO p_total_count
    FROM TEST_STEP t
    JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
    JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
    WHERE (p_transaction_type IS NULL OR t.TRANSACTION_TYPE = p_transaction_type)
      AND (p_response_code IS NULL OR t.EXPECTED_RESPONSE_CODE = p_response_code)
      AND (p_priority IS NULL OR t.PRIORITY = p_priority)
      AND (p_category IS NULL OR tc.CATEGORY = p_category)
      AND tc.VERSION_STATUS = 'PUBLISHED';
    
    -- 페이징 결과
    OPEN p_result FOR
        SELECT * FROM (
            SELECT 
                tc.FILE_NAME,
                tc.TITLE,
                ts.SCENARIO_NAME,
                t.CASE_NO,
                t.PRIORITY,
                t.TRANSACTION_TYPE,
                t.EXPECTED_RESPONSE_CODE,
                t.REQUEST_JSON,
                t.EXPECTED_JSON,
                ROW_NUMBER() OVER (ORDER BY t.STEP_ID) AS rn
            FROM TEST_STEP t
            JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
            JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
            WHERE (p_transaction_type IS NULL OR t.TRANSACTION_TYPE = p_transaction_type)
              AND (p_response_code IS NULL OR t.EXPECTED_RESPONSE_CODE = p_response_code)
              AND (p_priority IS NULL OR t.PRIORITY = p_priority)
              AND (p_category IS NULL OR tc.CATEGORY = p_category)
              AND tc.VERSION_STATUS = 'PUBLISHED'
        )
        WHERE rn BETWEEN v_offset + 1 AND v_offset + p_page_size;
END;
/


-- 5-3. 검색 인덱스 자동 업데이트 트리거
CREATE OR REPLACE TRIGGER TRG_UPDATE_SEARCH_INDEX
AFTER INSERT OR UPDATE ON TEST_STEP
FOR EACH ROW
DECLARE
    v_case_id NUMBER;
    v_request_map JSON_OBJECT_T;
    v_expected_map JSON_OBJECT_T;
    v_keys JSON_KEY_LIST;
BEGIN
    -- CASE_ID 조회
    SELECT tc.CASE_ID INTO v_case_id
    FROM TEST_SCENARIO ts
    JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
    WHERE ts.SCENARIO_ID = :NEW.SCENARIO_ID;
    
    -- 기존 인덱스 삭제
    DELETE FROM TEST_SEARCH_INDEX WHERE STEP_ID = :NEW.STEP_ID;
    
    -- REQUEST_JSON 파싱하여 인덱스 생성
    v_request_map := JSON_OBJECT_T(:NEW.REQUEST_JSON);
    v_keys := v_request_map.get_keys;
    
    FOR i IN 1..v_keys.COUNT LOOP
        INSERT INTO TEST_SEARCH_INDEX (
            INDEX_ID, STEP_ID, CASE_ID, FIELD_NAME, FIELD_VALUE, SOURCE_TYPE
        ) VALUES (
            SEQ_TEST_SEARCH_INDEX.NEXTVAL,
            :NEW.STEP_ID,
            v_case_id,
            v_keys(i),
            v_request_map.get_String(v_keys(i)),
            'REQUEST'
        );
    END LOOP;
    
    -- EXPECTED_JSON 파싱하여 인덱스 생성
    v_expected_map := JSON_OBJECT_T(:NEW.EXPECTED_JSON);
    v_keys := v_expected_map.get_keys;
    
    FOR i IN 1..v_keys.COUNT LOOP
        INSERT INTO TEST_SEARCH_INDEX (
            INDEX_ID, STEP_ID, CASE_ID, FIELD_NAME, FIELD_VALUE, SOURCE_TYPE
        ) VALUES (
            SEQ_TEST_SEARCH_INDEX.NEXTVAL,
            :NEW.STEP_ID,
            v_case_id,
            v_keys(i),
            v_expected_map.get_String(v_keys(i)),
            'EXPECTED'
        );
    END LOOP;
    
EXCEPTION
    WHEN OTHERS THEN
        -- JSON 파싱 실패 시 무시 (로깅만)
        NULL;
END;
/


-- ========================================
-- 6. 성능 모니터링 뷰
-- ========================================

-- 6-1. 느린 쿼리 추적
CREATE OR REPLACE VIEW V_SLOW_SEARCHES AS
SELECT 
    SEARCH_KEYWORD,
    SEARCH_TYPE,
    AVG(EXECUTION_TIME_MS) AS AVG_TIME_MS,
    MAX(EXECUTION_TIME_MS) AS MAX_TIME_MS,
    COUNT(*) AS SEARCH_COUNT
FROM TEST_SEARCH_LOG
WHERE SEARCHED_AT >= SYSDATE - 7  -- 최근 7일
GROUP BY SEARCH_KEYWORD, SEARCH_TYPE
HAVING AVG(EXECUTION_TIME_MS) > 1000  -- 1초 이상
ORDER BY AVG_TIME_MS DESC;


-- 6-2. 인기 검색어
CREATE OR REPLACE VIEW V_POPULAR_SEARCHES AS
SELECT 
    SEARCH_KEYWORD,
    COUNT(*) AS SEARCH_COUNT,
    AVG(RESULT_COUNT) AS AVG_RESULTS
FROM TEST_SEARCH_LOG
WHERE SEARCHED_AT >= SYSDATE - 30  -- 최근 30일
GROUP BY SEARCH_KEYWORD
ORDER BY SEARCH_COUNT DESC
FETCH FIRST 100 ROWS ONLY;


-- ========================================
-- 7. 데이터베이스 통계 수집 (성능 최적화)
-- ========================================

BEGIN
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'TEST_CASE');
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'TEST_SCENARIO');
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'TEST_STEP');
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'TEST_SEARCH_INDEX');
END;
/


-- ========================================
-- 8. 샘플 검색 쿼리 (성능 테스트용)
-- ========================================

-- 예시 1: 거래방법 = 'A'인 모든 스텝 검색 (인덱스 사용)
/*
SELECT tc.FILE_NAME, ts.SCENARIO_NAME, t.CASE_NO, t.REQUEST_JSON
FROM TEST_STEP t
JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
WHERE t.TRANSACTION_TYPE = 'A'
  AND tc.VERSION_STATUS = 'PUBLISHED';
-- 실행 계획: INDEX RANGE SCAN (IDX_STEP_TRANSACTION)
*/

-- 예시 2: 응답코드 = '0000'인 스텝 검색
/*
SELECT tc.FILE_NAME, t.CASE_NO, t.EXPECTED_JSON
FROM TEST_STEP t
JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
WHERE t.EXPECTED_RESPONSE_CODE = '0000'
  AND tc.VERSION_STATUS = 'PUBLISHED';
-- 실행 계획: INDEX RANGE SCAN (IDX_STEP_RESPONSE_CODE)
*/

-- 예시 3: 역인덱스로 JSON 필드 검색
/*
SELECT DISTINCT tc.FILE_NAME, ts.SCENARIO_NAME, t.CASE_NO
FROM TEST_SEARCH_INDEX si
JOIN TEST_STEP t ON si.STEP_ID = t.STEP_ID
JOIN TEST_SCENARIO ts ON t.SCENARIO_ID = ts.SCENARIO_ID
JOIN TEST_CASE tc ON ts.CASE_ID = tc.CASE_ID
WHERE si.FIELD_NAME = '원승인번호'
  AND si.FIELD_VALUE = '12345678';
-- 실행 계획: INDEX RANGE SCAN (IDX_SEARCH_FIELD_VALUE)
*/

-- 예시 4: 복합 조건 검색 (프로시저 사용)
/*
DECLARE
    v_result SYS_REFCURSOR;
    v_total NUMBER;
BEGIN
    PROC_SEARCH_ADVANCED(
        p_transaction_type => 'A',
        p_response_code => '0000',
        p_priority => 'HIGH',
        p_page => 1,
        p_page_size => 100,
        p_result => v_result,
        p_total_count => v_total
    );
    
    DBMS_OUTPUT.PUT_LINE('Total: ' || v_total);
END;
/
*/

COMMIT;
