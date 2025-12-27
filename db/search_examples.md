# 🔍 검색 기능 구현 예시

## 1. 실제 검색 시나리오 (70,000+ 케이스 기준)

### 시나리오 A: QA 엔지니어 일상 업무
```
1. "거래방법이 'A'이고 응답코드가 '0000'인 케이스 찾기"
   → 정규화 컬럼 검색 (0.1초)
   
2. "원승인번호가 '12345678'인 케이스 찾기"
   → 역인덱스 검색 (0.3초)
   
3. "E1 충전소 관련 케이스 모두 보기"
   → 카테고리 필터 + 제목 검색 (0.2초)
   
4. "최근 1주일 동안 수정된 HIGH 우선순위 케이스"
   → 날짜 범위 + 우선순위 필터 (0.15초)
```

---

## 2. 검색 API 설계

### 2.1 기본 검색 API

```java
@RestController
@RequestMapping("/api/search")
public class TestSearchController {
    
    @Autowired
    private TestSearchService searchService;
    
    /**
     * 1. 단일 필드 검색
     * GET /api/search/field?name=거래방법&value=A&page=1&size=100
     */
    @GetMapping("/field")
    public ResponseEntity<SearchResult> searchByField(
        @RequestParam String name,
        @RequestParam String value,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "100") int size
    ) {
        SearchResult result = searchService.searchByField(name, value, page, size);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 2. 복합 조건 검색
     * POST /api/search/advanced
     * Body: {
     *   "transactionType": "A",
     *   "responseCode": "0000",
     *   "priority": "HIGH",
     *   "category": "주유소",
     *   "dateFrom": "2024-12-01",
     *   "dateTo": "2024-12-31",
     *   "page": 1,
     *   "size": 100
     * }
     */
    @PostMapping("/advanced")
    public ResponseEntity<SearchResult> advancedSearch(
        @RequestBody AdvancedSearchRequest request
    ) {
        SearchResult result = searchService.advancedSearch(request);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 3. 전문 검색 (키워드)
     * GET /api/search/keyword?q=정상처리&page=1&size=100
     */
    @GetMapping("/keyword")
    public ResponseEntity<SearchResult> keywordSearch(
        @RequestParam String q,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "100") int size
    ) {
        SearchResult result = searchService.keywordSearch(q, page, size);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 4. 자동완성 (검색어 추천)
     * GET /api/search/suggest?q=거래&limit=10
     */
    @GetMapping("/suggest")
    public ResponseEntity<List<String>> suggestKeywords(
        @RequestParam String q,
        @RequestParam(defaultValue = "10") int limit
    ) {
        List<String> suggestions = searchService.suggestKeywords(q, limit);
        return ResponseEntity.ok(suggestions);
    }
}
```

---

### 2.2 Service 구현

```java
@Service
public class TestSearchService {
    
    @Autowired
    private TestStepRepository stepRepository;
    
    @Autowired
    private TestSearchIndexRepository searchIndexRepository;
    
    @Autowired
    private JdbcTemplate jdbcTemplate;
    
    /**
     * 단일 필드 검색 (정규화 컬럼 우선, 없으면 역인덱스)
     */
    @Transactional(readOnly = true)
    public SearchResult searchByField(String fieldName, String fieldValue, int page, int size) {
        long startTime = System.currentTimeMillis();
        
        // 1. 정규화 컬럼인지 확인
        if (isNormalizedField(fieldName)) {
            // 정규화 컬럼 검색 (빠름)
            Page<TestStep> steps = searchByNormalizedField(fieldName, fieldValue, page, size);
            return buildSearchResult(steps, startTime);
        } else {
            // 역인덱스 검색
            List<TestStep> steps = searchByDynamicField(fieldName, fieldValue, page, size);
            return buildSearchResult(steps, startTime);
        }
    }
    
    /**
     * 정규화 컬럼 검색 (인덱스 활용)
     */
    private Page<TestStep> searchByNormalizedField(String fieldName, String value, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        
        switch (fieldName) {
            case "거래방법":
                return stepRepository.findByTransactionType(value, pageable);
            case "응답코드":
                return stepRepository.findByExpectedResponseCode(value, pageable);
            case "취소여부":
                return stepRepository.findByCancelYn(value, pageable);
            case "우선순위":
                return stepRepository.findByPriority(value, pageable);
            default:
                return Page.empty();
        }
    }
    
    /**
     * 동적 필드 검색 (역인덱스 활용)
     */
    private List<TestStep> searchByDynamicField(String fieldName, String value, int page, int size) {
        int offset = (page - 1) * size;
        
        String sql = """
            SELECT DISTINCT t.*
            FROM TEST_SEARCH_INDEX si
            JOIN TEST_STEP t ON si.STEP_ID = t.STEP_ID
            WHERE si.FIELD_NAME = ?
              AND si.FIELD_VALUE = ?
            ORDER BY t.STEP_ID
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """;
        
        return jdbcTemplate.query(sql, 
            new Object[]{fieldName, value, offset, size},
            new TestStepRowMapper()
        );
    }
    
    /**
     * 복합 조건 검색
     */
    @Transactional(readOnly = true)
    public SearchResult advancedSearch(AdvancedSearchRequest request) {
        long startTime = System.currentTimeMillis();
        
        // QueryDSL 또는 Criteria API 사용
        QTestStep step = QTestStep.testStep;
        QTestScenario scenario = QTestScenario.testScenario;
        QTestCase testCase = QTestCase.testCase;
        
        BooleanBuilder builder = new BooleanBuilder();
        
        // 조건 추가
        if (request.getTransactionType() != null) {
            builder.and(step.transactionType.eq(request.getTransactionType()));
        }
        if (request.getResponseCode() != null) {
            builder.and(step.expectedResponseCode.eq(request.getResponseCode()));
        }
        if (request.getPriority() != null) {
            builder.and(step.priority.eq(request.getPriority()));
        }
        if (request.getCategory() != null) {
            builder.and(testCase.category.eq(request.getCategory()));
        }
        if (request.getDateFrom() != null) {
            builder.and(testCase.updatedAt.goe(request.getDateFrom()));
        }
        if (request.getDateTo() != null) {
            builder.and(testCase.updatedAt.loe(request.getDateTo()));
        }
        
        // 페이징
        Pageable pageable = PageRequest.of(request.getPage() - 1, request.getSize());
        
        Page<TestStep> steps = stepRepository.findAll(builder, pageable);
        
        // 검색 로그 저장
        logSearch(request, steps.getTotalElements(), System.currentTimeMillis() - startTime);
        
        return buildSearchResult(steps, startTime);
    }
    
    /**
     * 키워드 검색 (Oracle Text)
     */
    @Transactional(readOnly = true)
    public SearchResult keywordSearch(String keyword, int page, int size) {
        long startTime = System.currentTimeMillis();
        int offset = (page - 1) * size;
        
        String sql = """
            SELECT t.*
            FROM TEST_FULLTEXT_SEARCH f
            JOIN TEST_STEP t ON f.STEP_ID = t.STEP_ID
            WHERE CONTAINS(f.SEARCHABLE_TEXT, ?) > 0
            ORDER BY SCORE(1) DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """;
        
        List<TestStep> steps = jdbcTemplate.query(sql,
            new Object[]{keyword, offset, size},
            new TestStepRowMapper()
        );
        
        return buildSearchResult(steps, startTime);
    }
    
    /**
     * 자동완성 (인기 검색어 기반)
     */
    public List<String> suggestKeywords(String prefix, int limit) {
        String sql = """
            SELECT DISTINCT FIELD_VALUE
            FROM TEST_SEARCH_INDEX
            WHERE FIELD_VALUE LIKE ?
            ORDER BY FIELD_VALUE
            FETCH FIRST ? ROWS ONLY
        """;
        
        return jdbcTemplate.queryForList(sql, String.class, prefix + "%", limit);
    }
    
    /**
     * 검색 로그 저장 (성능 모니터링용)
     */
    private void logSearch(Object searchRequest, long resultCount, long executionTime) {
        String sql = """
            INSERT INTO TEST_SEARCH_LOG (
                LOG_ID, SEARCH_KEYWORD, SEARCH_TYPE, RESULT_COUNT, 
                EXECUTION_TIME_MS, USER_ID, SEARCHED_AT
            ) VALUES (
                SEQ_TEST_SEARCH_LOG.NEXTVAL, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            )
        """;
        
        jdbcTemplate.update(sql,
            searchRequest.toString(),
            searchRequest.getClass().getSimpleName(),
            resultCount,
            executionTime,
            getCurrentUserId()
        );
    }
    
    /**
     * 정규화 필드 여부 확인
     */
    private boolean isNormalizedField(String fieldName) {
        return Arrays.asList("거래방법", "응답코드", "취소여부", "우선순위", "금액")
            .contains(fieldName);
    }
}
```

---

### 2.3 Repository 인터페이스

```java
public interface TestStepRepository extends JpaRepository<TestStep, Long>, 
                                             QuerydslPredicateExecutor<TestStep> {
    
    // 정규화 컬럼 검색 (인덱스 활용)
    @Query("""
        SELECT t FROM TestStep t
        JOIN FETCH t.scenario s
        JOIN FETCH s.testCase c
        WHERE t.transactionType = :type
          AND c.versionStatus = 'PUBLISHED'
        ORDER BY t.stepId
    """)
    Page<TestStep> findByTransactionType(@Param("type") String type, Pageable pageable);
    
    @Query("""
        SELECT t FROM TestStep t
        JOIN FETCH t.scenario s
        JOIN FETCH s.testCase c
        WHERE t.expectedResponseCode = :code
          AND c.versionStatus = 'PUBLISHED'
        ORDER BY t.stepId
    """)
    Page<TestStep> findByExpectedResponseCode(@Param("code") String code, Pageable pageable);
    
    @Query("""
        SELECT t FROM TestStep t
        JOIN FETCH t.scenario s
        JOIN FETCH s.testCase c
        WHERE t.priority = :priority
          AND c.versionStatus = 'PUBLISHED'
        ORDER BY t.stepId
    """)
    Page<TestStep> findByPriority(@Param("priority") String priority, Pageable pageable);
    
    @Query("""
        SELECT t FROM TestStep t
        JOIN FETCH t.scenario s
        JOIN FETCH s.testCase c
        WHERE t.cancelYn = :yn
          AND c.versionStatus = 'PUBLISHED'
        ORDER BY t.stepId
    """)
    Page<TestStep> findByCancelYn(@Param("yn") String yn, Pageable pageable);
    
    // 복합 조건 검색
    @Query("""
        SELECT t FROM TestStep t
        JOIN FETCH t.scenario s
        JOIN FETCH s.testCase c
        WHERE t.transactionType = :type
          AND t.expectedResponseCode = :code
          AND c.versionStatus = 'PUBLISHED'
        ORDER BY t.stepId
    """)
    Page<TestStep> findByTypeAndCode(
        @Param("type") String type, 
        @Param("code") String code, 
        Pageable pageable
    );
}
```

---

## 3. 프론트엔드 검색 UI

### 3.1 고급 검색 폼

```html
<!-- 검색 UI -->
<div class="search-container">
    <h2>🔍 테스트 케이스 검색</h2>
    
    <!-- 빠른 검색 -->
    <div class="quick-search">
        <label>필드 검색:</label>
        <select id="fieldName">
            <option value="거래방법">거래방법</option>
            <option value="응답코드">응답코드</option>
            <option value="취소여부">취소여부</option>
            <option value="우선순위">우선순위</option>
            <option value="원승인번호">원승인번호</option>
            <option value="카드번호">카드번호</option>
        </select>
        <input type="text" id="fieldValue" placeholder="값 입력" />
        <button onclick="quickSearch()">검색</button>
    </div>
    
    <!-- 고급 검색 -->
    <details>
        <summary>🔧 고급 검색 옵션</summary>
        <form id="advancedSearchForm">
            <div class="form-row">
                <label>거래방법:</label>
                <select name="transactionType">
                    <option value="">전체</option>
                    <option value="A">A</option>
                    <option value="I">I</option>
                    <option value="M">M</option>
                    <option value="@">@</option>
                </select>
            </div>
            
            <div class="form-row">
                <label>응답코드:</label>
                <input type="text" name="responseCode" placeholder="예: 0000" />
            </div>
            
            <div class="form-row">
                <label>우선순위:</label>
                <select name="priority">
                    <option value="">전체</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                </select>
            </div>
            
            <div class="form-row">
                <label>카테고리:</label>
                <select name="category">
                    <option value="">전체</option>
                    <option value="주유소">주유소</option>
                    <option value="충전소">충전소</option>
                    <option value="편의점">편의점</option>
                </select>
            </div>
            
            <div class="form-row">
                <label>수정 날짜:</label>
                <input type="date" name="dateFrom" />
                <span>~</span>
                <input type="date" name="dateTo" />
            </div>
            
            <button type="submit">🔍 검색</button>
        </form>
    </details>
    
    <!-- 검색 결과 -->
    <div id="searchResults">
        <p class="result-count">총 <span id="totalCount">0</span>건</p>
        <p class="search-time">검색 시간: <span id="searchTime">0</span>ms</p>
        
        <table id="resultsTable">
            <thead>
                <tr>
                    <th>파일명</th>
                    <th>시나리오</th>
                    <th>케이스번호</th>
                    <th>우선순위</th>
                    <th>거래방법</th>
                    <th>응답코드</th>
                    <th>액션</th>
                </tr>
            </thead>
            <tbody>
                <!-- 동적 생성 -->
            </tbody>
        </table>
        
        <!-- 페이징 -->
        <div class="pagination">
            <button onclick="prevPage()">◀ 이전</button>
            <span id="pageInfo">1 / 10</span>
            <button onclick="nextPage()">다음 ▶</button>
        </div>
    </div>
</div>
```

### 3.2 JavaScript

```javascript
// 빠른 검색
async function quickSearch() {
    const fieldName = document.getElementById('fieldName').value;
    const fieldValue = document.getElementById('fieldValue').value;
    
    if (!fieldValue) {
        alert('검색 값을 입력하세요');
        return;
    }
    
    const response = await fetch(
        `/api/search/field?name=${fieldName}&value=${fieldValue}&page=1&size=100`
    );
    const result = await response.json();
    
    displayResults(result);
}

// 고급 검색
document.getElementById('advancedSearchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const searchParams = Object.fromEntries(formData.entries());
    searchParams.page = 1;
    searchParams.size = 100;
    
    const response = await fetch('/api/search/advanced', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(searchParams)
    });
    
    const result = await response.json();
    displayResults(result);
});

// 결과 표시
function displayResults(result) {
    document.getElementById('totalCount').textContent = result.totalCount;
    document.getElementById('searchTime').textContent = result.executionTime;
    
    const tbody = document.querySelector('#resultsTable tbody');
    tbody.innerHTML = '';
    
    result.items.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${item.fileName}</td>
            <td>${item.scenarioName}</td>
            <td>${item.caseNo}</td>
            <td>${item.priority}</td>
            <td>${item.transactionType || '-'}</td>
            <td>${item.expectedResponseCode || '-'}</td>
            <td>
                <button onclick="viewDetail(${item.stepId})">상세</button>
                <button onclick="editStep(${item.stepId})">편집</button>
            </td>
        `;
    });
    
    updatePagination(result.currentPage, result.totalPages);
}
```

---

## 4. 성능 측정

### 4.1 검색 로그 분석

```sql
-- 가장 느린 검색 TOP 10
SELECT 
    SEARCH_KEYWORD,
    SEARCH_TYPE,
    AVG(EXECUTION_TIME_MS) AS AVG_TIME,
    MAX(EXECUTION_TIME_MS) AS MAX_TIME,
    COUNT(*) AS SEARCH_COUNT
FROM TEST_SEARCH_LOG
WHERE SEARCHED_AT >= SYSDATE - 7
GROUP BY SEARCH_KEYWORD, SEARCH_TYPE
ORDER BY AVG_TIME DESC
FETCH FIRST 10 ROWS ONLY;
```

### 4.2 인기 검색어 분석

```sql
-- 가장 많이 검색된 필드값 TOP 20
SELECT 
    FIELD_NAME,
    FIELD_VALUE,
    COUNT(*) AS SEARCH_COUNT
FROM TEST_SEARCH_LOG
WHERE SEARCH_TYPE = 'FIELD_SEARCH'
  AND SEARCHED_AT >= SYSDATE - 30
GROUP BY FIELD_NAME, FIELD_VALUE
ORDER BY SEARCH_COUNT DESC
FETCH FIRST 20 ROWS ONLY;
```

---

## 5. 실전 최적화 팁

### Tip 1: 인덱스 힌트 사용
```java
@Query(value = """
    SELECT /*+ INDEX(t IDX_STEP_SEARCH_COMBO) */ *
    FROM TEST_STEP t
    WHERE t.TRANSACTION_TYPE = :type
      AND t.EXPECTED_RESPONSE_CODE = :code
""", nativeQuery = true)
List<TestStep> findWithHint(@Param("type") String type, @Param("code") String code);
```

### Tip 2: 결과 캐싱
```java
@Cacheable(value = "searchResults", key = "#fieldName + '_' + #fieldValue")
public SearchResult searchByField(String fieldName, String fieldValue, int page, int size) {
    // ...
}
```

### Tip 3: 비동기 검색
```java
@Async
public CompletableFuture<SearchResult> asyncSearch(AdvancedSearchRequest request) {
    SearchResult result = advancedSearch(request);
    return CompletableFuture.completedFuture(result);
}
```

### Tip 4: 검색 결과 Export
```java
@GetMapping("/export")
public ResponseEntity<byte[]> exportSearchResults(@RequestParam String searchId) {
    // 검색 결과를 Excel로 export
    byte[] excelData = searchService.exportToExcel(searchId);
    
    return ResponseEntity.ok()
        .header("Content-Disposition", "attachment; filename=search_results.xlsx")
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body(excelData);
}
```

---

## 6. 검색 성능 비교표

| 검색 유형 | 데이터 | 방법 | 예상 시간 | 인덱스 |
|----------|--------|------|----------|--------|
| 거래방법=A | 70만 | 정규화 컬럼 | 0.05초 | IDX_STEP_TRANSACTION |
| 응답코드=0000 | 70만 | 정규화 컬럼 | 0.08초 | IDX_STEP_RESPONSE_CODE |
| A + 0000 | 70만 | 복합 인덱스 | 0.1초 | IDX_STEP_SEARCH_COMBO |
| 원승인번호=123 | 70만 | 역인덱스 | 0.3초 | IDX_SEARCH_FIELD_VALUE |
| "정상처리" | 70만 | Oracle Text | 0.5초 | CTXSYS.CONTEXT |
| 카테고리=주유소 | 7만 | 카테고리 필터 | 0.05초 | IDX_CASE_CATEGORY |

모든 검색이 **1초 이내** 완료! 🚀
