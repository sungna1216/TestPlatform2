// managers/step-manager.js

import { getScenarioConfig } from './scenario-data-manager.js';

/**
 * 새로운 스텝 한 줄 <tr> 추가
 */
export function addStep(scenarioIdx, stepData = null) {
  const config = getScenarioConfig(scenarioIdx);
  if (!config) return;

  const stepTable = document.getElementById(`stepTable${scenarioIdx}`)?.querySelector('tbody');
  if (!stepTable) return;

  const stepIndex = stepTable.children.length;

  // 마지막 스텝의 값 복사
  if (!stepData && stepIndex > 0) {
    const last = stepTable.lastElementChild;
    stepData = extractStepDataFromRow(last, config);
  }

  const row = document.createElement('tr');

  // 선택 + caseNo
  row.innerHTML += `
    <td><input type="checkbox" class="select-step-checkbox" /></td>
    <td><input type="text" name="scenarios[${scenarioIdx}].steps[${stepIndex}].caseNo" value="${stepData?.caseNo || ''}" readonly /></td>
  `;

  // 삭제 버튼
  row.innerHTML += `
    <td><button type="button" class="btn-danger" data-action="remove-step">🗑</button></td>
  `;
  // 요청 필드
  config.requestFields.forEach((key, i) => {
    row.innerHTML += `
      <td>
        <input type="hidden" name="scenarios[${scenarioIdx}].steps[${stepIndex}].keys[${i}]" value="${key}" />
        <input name="scenarios[${scenarioIdx}].steps[${stepIndex}].values[${i}]" value="${stepData?.values?.[i] || ''}" />
      </td>
    `;
  });

  // 검증 필드
  config.expectedFields.forEach((key, i) => {
    row.innerHTML += `
      <td>
        <input type="hidden" name="scenarios[${scenarioIdx}].steps[${stepIndex}].expectedKeys[${i}]" value="${key}" />
        <input name="scenarios[${scenarioIdx}].steps[${stepIndex}].expectedValues[${i}]" value="${stepData?.expectedValues?.[i] || ''}" />
      </td>
    `;
  });


  stepTable.appendChild(row);
}

/**
 * <tr> DOM에서 step 데이터를 추출 (복사용)
 */
function extractStepDataFromRow(row, config) {
  const getInputs = (selector) => Array.from(row.querySelectorAll(selector)).map(i => i.value);

  const values = row.querySelectorAll('input[name$=".values"]');
  const expectedValues = row.querySelectorAll('input[name$=".expectedValues"]');

  return {
    caseNo: row.querySelector('input[name$=".caseNo"]')?.value || '',
    values: Array.from(values).map(i => i.value),
    expectedValues: Array.from(expectedValues).map(i => i.value)
  };
}

/**
 * 스텝 인덱스 재정렬 (삭제/복사 후)
 */
export function reorderStepIndices(scenarioIdx) {
  const stepTable = document.getElementById(`stepTable${scenarioIdx}`)?.querySelector('tbody');
  if (!stepTable) return;

  Array.from(stepTable.rows).forEach((row, newIdx) => {
    row.querySelectorAll('input, select').forEach(input => {
      if (input.name) {
        input.name = input.name.replace(
          /(scenarios\[\d+\]\.steps\[)(\d+)(\].*)/,
          `$1${newIdx}$3`
        );
      }
    });
  });
}
