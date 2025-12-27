// main/test-form-init.js

import { loadInitialData, registerScenario, getScenarioConfig } from '../managers/scenario-data-manager.js';
import { renderScenarioFields } from '../managers/scenario-renderer.js';
import { addStep } from '../managers/step-manager.js';
import { initSortableForScenario } from '../managers/drag-and-drop.js';
import { bindEvents, createScenarioHTML } from '../managers/event-bindings.js';

$(document).ready(() => {
  const jsonText = document.getElementById('scenariosJson')?.value || '[]';

  try {
    const scenarioList = loadInitialData(jsonText);

    scenarioList.forEach(({ index, scenarioName, steps }) => {
      renderScenario(index, scenarioName, steps);
    });

    if (scenarioList.length === 0) {
      const index = registerScenario();
      renderScenario(index, '', []);
    }

  } catch (e) {
    console.error('초기 시나리오 로딩 실패:', e);
  }

  bindEvents();
});

/**
 * 시나리오 1개를 DOM에 렌더링
 */
function renderScenario(index, scenarioName, steps = []) {
  createScenarioHTML(index, scenarioName);
  renderScenarioFields(index, 'handleFieldInput', getDragHandlers());

  if (Array.isArray(steps) && steps.length > 0) {
    steps.forEach(step => addStep(index, step));
  } else {
    addStep(index);
  }

  initSortableForScenario(index);
}

function getDragHandlers() {
  return {
    start: 'handleDragStart',
    over: 'handleDragOver',
    drop: 'handleDrop'
  };
}
