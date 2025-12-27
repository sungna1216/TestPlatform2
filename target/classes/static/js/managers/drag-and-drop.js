// managers/drag-and-drop.js

import { reorderField, getScenarioConfig } from './scenario-data-manager.js';
import { reorderStepIndices } from './step-manager.js';

/**
 * Sortable 적용: 요청/검증 필드 + step 테이블 (tbody)
 */
export function initSortableForScenario(scenarioIdx) {
  const config = getScenarioConfig(scenarioIdx);
  if (!config) return;

  const reqContainer = document.getElementById(`reqFieldsContainer${scenarioIdx}`);
  const expContainer = document.getElementById(`expFieldsContainer${scenarioIdx}`);
  const stepTbody = document.querySelector(`#stepTable${scenarioIdx} tbody`);

  // 요청 필드
  if (reqContainer) {
    new window.Sortable(reqContainer, {
      animation: 150,
      group: 'fields',
      onEnd: (evt) => {
        reorderField(scenarioIdx, 'request', evt.oldIndex, evt.newIndex);
      }
    });
  }

  // 검증 필드
  if (expContainer) {
    new window.Sortable(expContainer, {
      animation: 150,
      group: 'fields',
      onEnd: (evt) => {
        reorderField(scenarioIdx, 'expected', evt.oldIndex, evt.newIndex);
      }
    });
  }

  // step 순서
  if (stepTbody) {
    new window.Sortable(stepTbody, {
      animation: 150,
      onEnd: () => {
        reorderStepIndices(scenarioIdx);
      }
    });
  }
}
