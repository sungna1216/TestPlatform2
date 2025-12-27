// managers/scenario-data-manager.js

let scenarioIndex = 0;
const scenarioFieldConfigs = [];

/**
 * 새 시나리오를 등록하고 인덱스를 반환합니다.
 */
export function registerScenario(reqFields = [''], expFields = ['']) {
  const index = scenarioIndex++;
  scenarioFieldConfigs[index] = {
    requestFields: [...reqFields],
    expectedFields: [...expFields]
  };
  return index;
}

/**
 * 시나리오 필드 구성을 반환합니다.
 */
export function getScenarioConfig(index) {
  return scenarioFieldConfigs[index];
}

/**
 * 시나리오 필드 구성 전체를 반환합니다.
 */
export function getAllScenarioConfigs() {
  return scenarioFieldConfigs;
}

/**
 * 시나리오에서 특정 필드 값을 업데이트합니다.
 */
export function updateField(index, fieldIdx, value, type) {
  if (!scenarioFieldConfigs[index]) return;
  scenarioFieldConfigs[index][`${type}Fields`][fieldIdx] = value;
}

/**
 * 필드 순서를 업데이트합니다.
 */
export function reorderField(index, type, oldIndex, newIndex) {
  const fields = scenarioFieldConfigs[index][`${type}Fields`];
  const [moved] = fields.splice(oldIndex, 1);
  fields.splice(newIndex, 0, moved);
}

/**
 * 필드 추가
 */
export function addField(index, type) {
  scenarioFieldConfigs[index][`${type}Fields`].push('');
}

/**
 * 필드 제거
 */
export function removeField(index, type) {
  if (scenarioFieldConfigs[index][`${type}Fields`].length <= 1) return false;
  scenarioFieldConfigs[index][`${type}Fields`].pop();
  return true;
}

/**
 * 시나리오 삭제
 */
export function removeScenario(index) {
  scenarioFieldConfigs[index] = null;
}

/**
 * 초기 JSON 데이터를 기반으로 시나리오 등록
 */
export function loadInitialData(jsonString = '[]') {
  const scenarios = JSON.parse(jsonString);
  if (!Array.isArray(scenarios)) return [];

  return scenarios.map(scenario => {
    const reqFields = scenario.steps?.[0]?.keys || [''];
    const expFields = scenario.steps?.[0]?.expectedKeys || [''];
    const index = registerScenario(reqFields, expFields);
    return {
      index,
      scenarioName: scenario.scenarioName || '',
      steps: scenario.steps || []
    };
  });
}
