// managers/scenario-renderer.js

import { getScenarioConfig } from './scenario-data-manager.js';
import { addStep } from './step-manager.js';

/**
 * 필드 렌더링 + 테이블 헤더 반영
 */
export function renderScenarioFields(scenarioIdx, onInputCallback, onDragHandlers) {
  const config = getScenarioConfig(scenarioIdx);
  if (!config) return;

  renderFieldSet(`reqFieldsContainer${scenarioIdx}`, config.requestFields, 'request', scenarioIdx, onInputCallback, onDragHandlers);
  renderFieldSet(`expFieldsContainer${scenarioIdx}`, config.expectedFields, 'expected', scenarioIdx, onInputCallback, onDragHandlers);
  renderStepTableHeader(scenarioIdx, config.requestFields, config.expectedFields);
}

/**
 * 요청/검증 필드 UI 렌더링
 */
function renderFieldSet(containerId, fields, type, scenarioIdx, onInputCallback, onDragHandlers) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = fields.map((field, idx) => `
    <div class="draggable-field" draggable="true"
         ondragstart="${onDragHandlers?.start}('${type}', ${idx}, ${scenarioIdx}, event)"
         ondragover="${onDragHandlers?.over}('${type}', ${idx}, event)"
         ondrop="${onDragHandlers?.drop}('${type}', ${idx}, ${scenarioIdx}, event)">
    <input type="text"
       value="${field}"
       data-scenario="${scenarioIdx}"
       data-idx="${idx}"
       data-type="${type}"
       class="field-input"
       placeholder="${type === 'request' ? 'Request' : 'Expected'} key" />
    </div>
  `).join('');
}

/**
 * step 테이블 <thead> 구성
 */
function renderStepTableHeader(scenarioIdx, requestFields, expectedFields) {
  const thead = document.querySelector(`#stepTable${scenarioIdx} thead`);
  if (!thead) return;
  const requestHeaders = requestFields.map(f => `<th>${f || '요청항목'}</th>`);
  const expectedHeaders = expectedFields.map(f => `<th>${f || '검증항목'}</th>`);
    // 2. 구분용 빈 th 추가 (너비 5px)
  const dividerTh = `<th class="column-divider" style="width: 5px; padding: 0; background: #666;"></th>`;
  const headers = [
    `<th>선택</th>`,
    `<th>caseNo</th>`,
    ...requestFields.map(f => `<th>${f || '요청항목'}</th>`),
    dividerTh,
    ...expectedFields.map(f => `<th>${f || '검증항목'}</th>`),
    `<th>삭제</th>`
  ];

  thead.innerHTML = `<tr>${headers.join('')}</tr>`;
}

/**
 * 기존 step 데이터를 추출 (값 보존용)
 */
export function extractSteps(scenarioIdx) {
  const tbody = document.querySelector(`#stepTable${scenarioIdx} tbody`);
  if (!tbody) return [];

  return Array.from(tbody.querySelectorAll('tr')).map(row => {
    const caseNo = row.querySelector('input[name*=".caseNo"]')?.value || '';

    const valuePairs = Array.from(row.querySelectorAll('input[name*=".values"]')).map(input => ({
      name: input.name,
      value: input.value
    }));
    const expectedPairs = Array.from(row.querySelectorAll('input[name*=".expectedValues"]')).map(input => ({
      name: input.name,
      value: input.value
    }));

    const values = valuePairs.map(v => v.value);
    const expectedValues = expectedPairs.map(v => v.value);

    return { caseNo, values, expectedValues };
  });
}

/**
 * step 데이터를 주입하여 테이블을 다시 구성
 */
export function rerenderStepsForScenarioWithData(scenarioIdx, stepDataList) {
  const config = getScenarioConfig(scenarioIdx);
  const tbody = document.querySelector(`#stepTable${scenarioIdx} tbody`);
  if (!tbody || !config) return;

  const requestSize = config.requestFields.length;
  const expectedSize = config.expectedFields.length;

  tbody.innerHTML = '';

  stepDataList.forEach(step => {
    step.values = adjustArraySize(step.values, requestSize);
    step.expectedValues = adjustArraySize(step.expectedValues, expectedSize);
    addStep(scenarioIdx, step);
  });
}

/**
 * 배열 길이를 필드 수에 맞게 보정
 */
function adjustArraySize(arr, targetLength) {
  const copy = [...arr];
  while (copy.length < targetLength) copy.push('');
  return copy.slice(0, targetLength);
}
