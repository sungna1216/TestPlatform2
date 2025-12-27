// 선택한 스텝들을 ArrayList<HashMap> 형식으로 변환
function getSelectedTestCases() {
  const testCases = [];

  const noteContent = document.querySelector('textarea[name="note"]').value.trim();
  testCases.push({
    history: noteContent || "NOTE",
    testName: document.querySelector('input[name="title"]').value || "TestCase"
  });

  const selectedPriorities = Array.from(document.getElementById('priorityFilter')?.selectedOptions || [])
    .map(opt => opt.value);

  document.querySelectorAll('.scenario-container').forEach(scenario => {
    const scenarioName = scenario.querySelector('input[name$=".scenarioName"]')?.value || 'Unnamed';
    const stepsData = [];
    const includedCaseNos = new Set();

    // ✅ 체크된 step 먼저 포함
    scenario.querySelectorAll('.select-step-checkbox:checked').forEach(checkbox => {
      const row = checkbox.closest('tr');
      if (!row) return;

      const caseNo = row.querySelector('input[name$=".caseNo"]')?.value;
      if (!caseNo || includedCaseNos.has(caseNo)) return;
      includedCaseNos.add(caseNo);

      const requestData = extractRequestData(row, caseNo);
      const expectedData = extractExpectedData(row, caseNo);

      stepsData.push(requestData);
      if (Object.keys(expectedData).length > 1) stepsData.push(expectedData);
    });

    // ✅ priority 기준으로 추가 포함
    scenario.querySelectorAll('tbody tr').forEach(row => {
      const caseNo = row.querySelector('input[name$=".caseNo"]')?.value;
      const priority = row.querySelector('select.priority-select')?.value;

      if (!caseNo || includedCaseNos.has(caseNo)) return;
      if (!selectedPriorities.includes(priority)) return;

      includedCaseNos.add(caseNo);

      const requestData = extractRequestData(row, caseNo);
      const expectedData = extractExpectedData(row, caseNo);

      stepsData.push(requestData);
      if (Object.keys(expectedData).length > 1) stepsData.push(expectedData);
    });

    if (stepsData.length > 0) {
      testCases.push({
        testCaseName: scenarioName,
        testCaseJson: stepsData
      });
    }
  });

  return testCases;
}

function extractRequestData(row, caseNo) {
  const requestData = { caseNo };
  const keys = row.querySelectorAll('input[name*=".keys["]');
  const values = row.querySelectorAll('input[name*=".values["]');

  values.forEach((input, idx) => {
    const key = keys[idx]?.value;
    if (key) requestData[key] = input.value;
  });

  return requestData;
}

function extractExpectedData(row, caseNo) {
  const expectedData = { caseNo };
  const keys = row.querySelectorAll('input[name*=".expectedKeys["]');
  const values = row.querySelectorAll('input[name*=".expectedValues["]');

  values.forEach((input, idx) => {
    const key = keys[idx]?.value;
    if (key) expectedData[key] = input.value;
  });

  return expectedData;
}



// 선택 건 테스트 실행 함수
export function runSelectedTests() {
    const selectedTestCases = getSelectedTestCases();
    const preview = document.getElementById('testPreview');
    if (!preview) {
      alert('⚠️ 미리보기 영역이 없습니다.');
      return;
    }

    if (selectedTestCases.length <= 1) {
      preview.textContent = '⚠️ 선택된 스텝이 없습니다.';
      return;
    }
    preview.textContent = JSON.stringify(selectedTestCases, null, 2);
    // Java 서버로 전송
    //sendTestCasesToServer(selectedTestCases);
}

// 서버로 테스트 케이스 전송
function sendTestCasesToServer(testCases) {
    const testFileName = document.getElementById('testFileName').value;
    
    fetch('/run-selected-tests', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fileName: testFileName,
            testCases: testCases
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('서버 응답 오류');
        }
        return response.json();
    })
    .then(data => {
        console.log('성공:', data);
        alert('선택한 테스트 케이스 실행이 시작되었습니다.');
    })
    .catch(error => {
        console.error('오류:', error);
        alert('테스트 실행 중 오류가 발생했습니다: ' + error.message);
    });
}