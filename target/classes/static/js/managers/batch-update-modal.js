// managers/batch-update-modal.js

import { closeModal, showModal } from './modal-util.js';

const SELECTORS = {
  modal: '#batchUpdateModal',
  basicFields: '#basicFields',
  conditionalFields: '#conditionalFields',
  modalTargetKey: '#modalTargetKey',
  modalNewValue: '#modalNewValue',
  modalConditionKey: '#modalConditionKey',
  modalConditionValue: '#modalConditionValue',
  modalTargetKeyConditional: '#modalTargetKeyConditional',
  modalNewValueConditional: '#modalNewValueConditional'
};

/**
 * 모달 표시
 */
export function showBatchModal() {
  if ($('.select-step-checkbox:checked').length === 0) {
    alert('변경할 스텝을 선택해주세요.');
    return;
  }

  showModal(SELECTORS.modal);
  resetModal();
}

/**
 * 모달 닫기
 */
export function closeBatchModal() {
  closeModal(SELECTORS.modal);
  resetModal();
}

/**
 * 일괄 업데이트 적용 (기본 / 조건부 모드 / 중요도 변경)
 */
export function applyBatchUpdate() {
  const mode = $('input[name="batchMode"]:checked').val();
  if (mode === 'priority') {
    applyPriorityBatchUpdate();  
  } else if (mode === 'conditional') {
    applyConditionalBatchUpdate();
  } else {
    applyBasicBatchUpdate();
  }
}
function applyPriorityBatchUpdate() {
  const selectedPriority = $('#modalPrioritySelect').val();

  const steps = $('.select-step-checkbox:checked').closest('tr');
  if (steps.length === 0) {
    alert('변경할 스텝을 선택해주세요.');
    return;
  }

  steps.each(function () {
    const $row = $(this);
    const $select = $row.find('select.priority-select');

    $select.val(selectedPriority);

    // <tr>에 클래스 변경
    $row.removeClass('priority-낮음 priority-보통 priority-높음')
        .addClass(`priority-${selectedPriority}`);
  });

  closeBatchModal();
  alert(`선택한 ${steps.length}개 스텝의 중요도가 '${selectedPriority}'로 변경되었습니다.`);
}
function applyBasicBatchUpdate() {
  const key = $(SELECTORS.modalTargetKey).val().trim();
  const value = $(SELECTORS.modalNewValue).val();

  if (!key) {
    alert('대상 키를 입력해주세요.');
    return;
  }

  const steps = $('.select-step-checkbox:checked').closest('.step-container, tr');
  let found = false;

  steps.each(function () {
    const changed = updateKeyValueInTable($(this), key, value);
    if (changed) found = true;
  });

  if (!found) {
    alert(`"${key}" 키가 선택된 스텝에 존재하지 않습니다.`);
    return;
  }

  closeBatchModal();
  alert(`${steps.length}개 스텝의 "${key}" 값이 변경되었습니다.`);
}

function applyConditionalBatchUpdate() {
  const condKey = $(SELECTORS.modalConditionKey).val().trim();
  const condVal = $(SELECTORS.modalConditionValue).val().trim();
  const targetKey = $(SELECTORS.modalTargetKeyConditional).val().trim();
  const newValue = $(SELECTORS.modalNewValueConditional).val();

  if (!condKey || !targetKey) {
    alert('조건 키와 대상 키를 모두 입력해주세요.');
    return;
  }

  let updatedCount = 0;
  $('.select-step-checkbox:checked').closest('.step-container, tr').each(function () {
    const $step = $(this);
    if (matchesCondition($step, condKey, condVal)) {
      const changed = updateKeyValueInTable($step, targetKey, newValue);
      if (changed) updatedCount++;
    }
  });

  closeBatchModal();
  alert(`조건을 만족하는 ${updatedCount}개 스텝이 업데이트되었습니다.`);
}

/**
 * 테이블 내 키값 변경
 */
function updateKeyValueInTable($step, key, value) {
  let changed = false;

  $step.find('table').each(function () {
    const $headers = $(this).find('tr:first-child input');
    const $values = $(this).find('tr:last-child input');

    $headers.each(function (i) {
      if ($(this).val() === key) {
        $values.eq(i).val(value);
        changed = true;
      }
    });
  });

  return changed;
}

/**
 * 조건 키/값 일치 여부 검사
 */
function matchesCondition($step, key, value) {
  let matched = false;

  $step.find('table').each(function () {
    const $headers = $(this).find('tr:first-child input');
    const $values = $(this).find('tr:last-child input');

    $headers.each(function (i) {
      if ($(this).val() === key && $values.eq(i).val() === value) {
        matched = true;
      }
    });
  });

  return matched;
}

/**
 * 모달 입력 필드 초기화 및 기본 모드 세팅
 */
function resetModal() {
  $('input[name="batchMode"][value="basic"]').prop('checked', true);
  $(SELECTORS.basicFields).show();
  $(SELECTORS.conditionalFields).hide();

  $(SELECTORS.modalTargetKey).val('');
  $(SELECTORS.modalNewValue).val('');
  $(SELECTORS.modalConditionKey).val('');
  $(SELECTORS.modalConditionValue).val('');
  $(SELECTORS.modalTargetKeyConditional).val('');
  $(SELECTORS.modalNewValueConditional).val('');
}
