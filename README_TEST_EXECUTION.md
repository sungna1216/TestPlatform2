# 테스트 실행 기능 가이드

## 구현된 기능

### 1. TCP 더미 서버 (포트 9090)
- **요청 형식** (MS949 인코딩, 고정길이 30바이트):
  - cardNo: 16바이트
  - settlementAmount: 12바이트  
  - requestMethod: 2바이트

- **응답 형식** (MS949 인코딩, 고정길이 37바이트):
  - responseCode: 4바이트 (0000=성공, 9999=거절)
  - approvalNo: 12바이트
  - responseMessage: 20바이트
  - discountYn: 1바이트 (Y/N)

- **자동 시작**: Spring Boot 애플리케이션과 함께 자동으로 시작됩니다.

### 2. 테스트 실행 로직
- **실행 모드**:
  - **병렬 실행 모드** (기본값): 시나리오 간 병렬 실행, 시나리오 내 순차 실행
  - **순차 실행 모드**: 모든 시나리오와 스텝을 순차적으로 실행
- **시나리오 내**: 항상 순차 실행 (한 스텝씩 차례대로)
- **시나리오 간**: 병렬/순차 선택 가능
- **진행률 추적**: 실시간 진행 상황 모니터링
- **일시정지/재개**: 실행 중 일시정지 가능

### 3. Result View
- **실시간 진행률**: 프로그레스 바로 진행 상황 표시
- **Pass/Fail 표시**:
  - ✅ **PASS**: 초록색 배경
  - ❌ **FAIL**: 빨간색 배경, 기댓값과 실제값을 세로로 분리 표시
- **요약 통계**: 총 케이스, 성공, 실패, 성공률

## 사용 방법

### 1. 서버 실행
```bash
# 백엔드 실행 (포트 8080, TCP 서버 9090 자동 시작)
mvn spring-boot:run

# 프론트엔드 실행 (포트 5174)
cd frontend
npm run dev
```

### 2. 테스트 케이스 작성
1. 케이스 편집기에서 시나리오 추가
2. 기본 필드가 자동 설정됩니다:
   - **요청**: cardNo, settlementAmount, requestMethod
   - **기댓값**: responseCode, approvalNo, responseMessage, discountYn

### 3. 테스트 실행
1. **실행 모드 선택**:
   - ☑️ **병렬 실행** (기본값): 여러 시나리오를 동시에 실행
   - ☐ **순차 실행**: 모든 시나리오를 차례대로 실행
   - 체크박스를 클릭하여 모드 전환

2. **선택 실행 (권장)**:
   - 실행할 케이스의 체크박스를 선택
   - Shift 키를 누르고 클릭하면 범위 선택 가능
   - "테스트 실행 (N개 선택)" 버튼 클릭
   - 선택한 케이스만 실행됩니다
   
3. **전체 실행**:
   - 아무것도 선택하지 않고 "테스트 실행" 버튼 클릭
   - 확인 메시지에서 "확인" 선택
   - 모든 케이스가 실행됩니다

4. **결과 확인**:
   - Result View로 자동 이동
   - 실시간 진행 상황 확인
   - 필요시 "일시정지" 버튼으로 중단 가능

**💡 팁**: 
- **병렬 실행**: 시나리오 간 실행 시간이 겹쳐서 전체 실행 시간이 짧아집니다.
- **순차 실행**: 실행 순서가 명확해서 디버깅이 쉽고, 실행시각을 보고 순서를 확인할 수 있습니다.
- 특정 케이스만 디버깅할 때는 선택 실행이 유용합니다.

### 4. 결과 해석
- **초록색 셀**: 기댓값과 실제값 일치 (PASS)
- **빨간색 셀**: 불일치 (FAIL)
  - 위: 기댓값
  - 아래: 실제값
- 하나라도 FAIL이면 해당 케이스 전체가 FAIL

## 예제 데이터

### 성공 케이스
```
cardNo: 1234567890123456
settlementAmount: 10000
requestMethod: 01
```

예상 응답:
```
responseCode: 0000
approvalNo: (12자리 숫자)
responseMessage: 정상승인
discountYn: Y
```

### 실패 케이스 (카드번호가 9999로 시작)
```
cardNo: 9999567890123456
settlementAmount: 10000
requestMethod: 01
```

예상 응답:
```
responseCode: 9999
approvalNo: 000000000000
responseMessage: 거절
discountYn: Y
```

## API 엔드포인트

### 테스트 실행 시작
```
POST /api/test-execution/start
Content-Type: application/json

{
  "scenarios": [
    {
      "scenarioName": "시나리오 1",
      "steps": [
        {
          "caseNo": "0001",
          "priority": "보통",
          "requestData": {
            "cardNo": "1234567890123456",
            "settlementAmount": "10000",
            "requestMethod": "01"
          },
          "expectedData": {
            "responseCode": "0000",
            "approvalNo": "",
            "responseMessage": "정상승인",
            "discountYn": "Y"
          }
        }
      ]
    }
  ]
}
```

### 결과 조회
```
GET /api/test-execution/{executionId}
```

### 일시정지
```
POST /api/test-execution/{executionId}/pause
```

### 재개
```
POST /api/test-execution/{executionId}/resume
```

## 주의사항

1. TCP 서버는 Spring Boot와 함께 자동으로 시작됩니다
2. 테스트 실행 중 백엔드 서버를 종료하면 진행 중인 테스트가 중단됩니다
3. 한국어 문자는 MS949 인코딩으로 처리됩니다
4. 고정길이 전문이므로 공백으로 패딩됩니다

## 트러블슈팅

### TCP 연결 실패
- 포트 9090이 이미 사용 중인지 확인
- 백엔드 서버가 정상 실행되었는지 확인

### CORS 에러
- WebConfig에서 프론트엔드 포트(5174) 허용 확인
- 브라우저 콘솔에서 에러 메시지 확인

### 결과가 업데이트되지 않음
- 브라우저 개발자 도구 > Network 탭에서 polling 요청 확인
- 백엔드 로그에서 에러 확인
