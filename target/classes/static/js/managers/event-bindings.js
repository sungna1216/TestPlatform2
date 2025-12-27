// managers/event-bindings.js

import {
  registerScenario,
  removeScenario,
  addField,
  removeField,
  updateField,
  getScenarioConfig
} from './scenario-data-manager.js';

import {
  renderScenarioFields,
  rerenderStepsForScenarioWithData,
  extractSteps
} from './scenario-renderer.js';

import {
  addStep,
  reorderStepIndices
} from './step-manager.js';

import {
  initSortableForScenario
} from './drag-and-drop.js';

import {
  showBatchModal,
  applyBatchUpdate,
  closeBatchModal
} from './batch-update-modal.js';

export function bindEvents() {
  // 시나리오 추가
  $(document).on('click', '[data-action="add-scenario"]', () => {
    const index = registerScenario();
    createScenarioHTML(index, '');
    renderScenarioFields(index, 'handleFieldInput', getDragHandlers());
    addStep(index);
    initSortableForScenario(index);
  });

  // 시나리오 삭제
  $(document).on('click', '[data-action="remove-scenario"]', (e) => {
    if (!confirm('이 시나리오를 삭제하시겠습니까?')) return;
    const $scenario = $(e.target).closest('.scenario-container');
    const index = $scenario.data('index');
    removeScenario(index);
    $scenario.remove();
  });

  // 필드 추가
  $(document).on('click', '[data-action="add-field"]', (e) => {
    const $btn = $(e.target);
    const scenarioIdx = $btn.closest('.scenario-container').data('index');
    const type = $btn.data('type');

    const oldStepData = extractSteps(scenarioIdx);
    addField(scenarioIdx, type);
    renderScenarioFields(scenarioIdx, 'handleFieldInput', getDragHandlers());
    rerenderStepsForScenarioWithData(scenarioIdx, oldStepData);
    reorderStepIndices(scenarioIdx);
  });

  // 필드 삭제
  $(document).on('click', '[data-action="remove-field"]', (e) => {
    const $btn = $(e.target);
    const scenarioIdx = $btn.closest('.scenario-container').data('index');
    const type = $btn.data('type');

    const oldStepData = extractSteps(scenarioIdx);
    const success = removeField(scenarioIdx, type);
    if (!success) {
      alert('최소 하나의 필드는 남아있어야 합니다.');
      return;
    }

    renderScenarioFields(scenarioIdx, 'handleFieldInput', getDragHandlers());
    rerenderStepsForScenarioWithData(scenarioIdx, oldStepData);
    reorderStepIndices(scenarioIdx);
  });

  // 필드 수정
  window.handleFieldInput = function (scenarioIdx, fieldIdx, value, type) {
    const oldStepData = extractSteps(scenarioIdx);
    updateField(scenarioIdx, fieldIdx, value, type);
    renderScenarioFields(scenarioIdx, 'handleFieldInput', getDragHandlers());
    rerenderStepsForScenarioWithData(scenarioIdx, oldStepData);
    reorderStepIndices(scenarioIdx);
  };

  // 스텝 추가
  $(document).on('click', '[data-action="add-step"]', (e) => {
    const scenarioIdx = $(e.target).data('scenario');
    addStep(scenarioIdx);
    reorderStepIndices(scenarioIdx);
  });

  // 스텝 삭제
  // 우클릭 이벤트 핸들러 추가
  $(document).on('click', '[data-action="remove-step"]', function (e) {
    const $row = $(this).closest('tr');
    const scenarioIdx = $(this).closest('table.step-table').attr('id').replace('stepTable', '');
  
    // ✅ 삭제 전 확인
    if (!confirm('선택한 스텝을 삭제하시겠습니까?')) return;
  
    $row.remove();
    reorderStepIndices(scenarioIdx);
  });



  // 스텝 복사
  $(document).on('click', '[data-action="copy-steps"]', (e) => {
    const scenarioIdx = $(e.target).data('scenario');
    const selected = $(`.scenario-container[data-index="${scenarioIdx}"] .select-step-checkbox:checked`);
    if (selected.length === 0) {
      alert('복사할 스텝을 선택해주세요.');
      return;
    }
    selected.each(function () {
      const $row = $(this).closest('tr');
      const cloned = $row.clone(true);
      cloned.find('input').each((i, input) => {
        if (input.name.includes('.caseNo')) {
          input.value = '';
        }
      });
      $(`#stepTable${scenarioIdx} tbody`).append(cloned);
    });
    reorderStepIndices(scenarioIdx);
  });
// 입력 중엔 아무것도 하지 않음
$(document).on('input', '.field-input', function () {
  // 값만 임시로 저장하고 렌더는 하지 않음
  const scenarioIdx = $(this).data('scenario');
  const idx = $(this).data('idx');
  const type = $(this).data('type');
  const value = $(this).val();

  // 필드 상태만 업데이트 (렌더링은 나중에)
  updateField(scenarioIdx, idx, value, type);
});

// 포커스 빠질 때만 렌더링
$(document).on('blur', '.field-input', function () {
  const scenarioIdx = $(this).data('scenario');
  const oldStepData = extractSteps(scenarioIdx);
  renderScenarioFields(scenarioIdx, 'handleFieldInput', getDragHandlers());
  rerenderStepsForScenarioWithData(scenarioIdx, oldStepData);
  reorderStepIndices(scenarioIdx);
});
  // 일괄 변경
  $(document).on('click', '[data-action="show-batch-modal"]', showBatchModal);
  $(document).on('click', '[data-action="apply-batch-update"]', applyBatchUpdate);
  $(document).on('click', '[data-action="close-batch-modal"]', closeBatchModal);

  // 모드 전환
  $(document).on('change', 'input[name="batchMode"]', function () {
    const mode = $(this).val();
    $('#basicFields').toggle(mode === 'basic');
    $('#conditionalFields').toggle(mode === 'conditional');
    $('#priorityFields').toggle(mode === 'priority');
  });

  // 저장 확인
  $('#testForm').on('submit', () => {
    return confirm('정말 이대로 전체 테스트 케이스를 저장하시겠습니까?');
  });

  // shift+선택
  let lastCheckedIndex = -1;
  $(document).on("click", ".select-step-checkbox", function (e) {
    const $checkboxes = $(".select-step-checkbox");
    const currentIndex = $checkboxes.index(this);

    if (e.shiftKey && lastCheckedIndex !== -1) {
      const [start, end] = [lastCheckedIndex, currentIndex].sort((a, b) => a - b);
      const isChecked = $(this).prop("checked");
      $checkboxes.slice(start, end + 1).prop("checked", isChecked)
        .closest("tr").toggleClass("selected", isChecked);
    } else {
      const isChecked = $(this).prop("checked");
      $(this).closest("tr").toggleClass("selected", isChecked);
    }

    lastCheckedIndex = currentIndex;
  });
}

function getDragHandlers() {
  return {
    start: 'handleDragStart',
    over: 'handleDragOver',
    drop: 'handleDrop'
  };
}

window.handleDragStart = function (type, index, scenarioIdx, e) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ type, index, scenarioIdx }));
  e.currentTarget.classList.add('dragging');
};
window.handleDragOver = function (type, targetIndex, e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};
window.handleDrop = function (type, targetIndex, scenarioIdx, e) {
  e.preventDefault();
  const data = JSON.parse(e.dataTransfer.getData('text/plain'));
  if (data.scenarioIdx !== scenarioIdx) return;

  const config = getScenarioConfig(scenarioIdx);
  const fields = config[`${type}Fields`];
  const [moved] = fields.splice(data.index, 1);
  fields.splice(targetIndex, 0, moved);

  const oldStepData = extractSteps(scenarioIdx);
  renderScenarioFields(scenarioIdx, 'handleFieldInput', getDragHandlers());
  rerenderStepsForScenarioWithData(scenarioIdx, oldStepData);
  reorderStepIndices(scenarioIdx);
}

export function createScenarioHTML(index, scenarioName) {
  const container = document.createElement('div');
  container.className = 'scenario-container';
  container.dataset.index = index;

  container.innerHTML = `
    <div class="scenario-header">
      <label>시나리오 이름:</label>
      <input type="text" name="scenarios[${index}].scenarioName" value="${scenarioName}" />
      <button class="btn-danger" data-action="remove-scenario">🗑 삭제</button>
    </div>

    <div class="field-controls">
      <label>요청 필드:</label>
      <span id="reqFieldsContainer${index}"></span>
      <button type="button" class="btn-small" data-action="add-field" data-type="request">[+]</button>
      <button type="button" class="btn-small" data-action="remove-field" data-type="request">[-]</button>

      <label style="margin-left:10px;">검증 필드:</label>
      <span id="expFieldsContainer${index}"></span>
      <button type="button" class="btn-small" data-action="add-field" data-type="expected">[+]</button>
      <button type="button" class="btn-small" data-action="remove-field" data-type="expected">[-]</button>
    </div>

    <table class="step-table" id="stepTable${index}" border="1">
      <thead></thead>
      <tbody></tbody>
    </table>

    <div class="step-controls">
      <button type="button" class="btn-primary" data-action="add-step" data-scenario="${index}">➕ 스텝 추가</button>
      <button type="button" class="btn-secondary" data-action="copy-steps" data-scenario="${index}">📄 선택 복사</button>
      <button type="button" class="btn-secondary" data-action="show-batch-modal" data-scenario="${index}">🔄 일괄 변경</button>
    </div>
  `;

  document.getElementById('scenariosContainer').appendChild(container);
}
