import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { testCaseApi } from '../lib/api';
import { cn } from '../lib/utils';

export default function CaseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    note: '',
    scenarios: []
  });
  const [selectedSteps, setSelectedSteps] = useState({});
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchMode, setBatchMode] = useState('basic'); // 'basic' or 'conditional'
  const [lastSelectedKey, setLastSelectedKey] = useState(null);

  useEffect(() => {
    if (id && id !== 'new') {
      loadCase();
    }
  }, [id]);

  const loadCase = async () => {
    try {
      setLoading(true);
      const response = await testCaseApi.getById(id);
      const data = response.data.form || { title: '', note: '', scenarios: [] };
      
      // priority 기본값 설정
      data.scenarios = data.scenarios.map(scenario => ({
        ...scenario,
        steps: scenario.steps.map(step => ({
          ...step,
          caseNo: step.caseNo || '0001',
          priority: step.priority || '보통',
          keys: step.keys || [],
          values: step.values || [],
          expectedKeys: step.expectedKeys || [],
          expectedValues: step.expectedValues || []
        }))
      }));
      
      setForm(data);
    } catch (error) {
      console.error('Failed to load case:', error);
      alert('케이스를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert('제목을 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      
      // JSON 직렬화로 훨씬 빠른 전송
      const payload = {
        title: form.title,
        note: form.note,
        scenarios: form.scenarios
      };

      if (id && id !== 'new') {
        await testCaseApi.update(id, payload);
        alert('저장되었습니다');
        // 편집기에 그대로 머묾
      } else {
        const response = await testCaseApi.create(payload);
        alert('저장되었습니다');
        // 새로 생성된 케이스의 편집 페이지로 이동
        navigate(`/cases/${response.data.id}`);
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const addScenario = () => {
    setForm(prev => ({
      ...prev,
      scenarios: [...prev.scenarios, {
        scenarioName: `시나리오 ${prev.scenarios.length + 1}`,
        steps: [{
          caseNo: '0001',
          priority: '보통',
          keys: ['bin', 'chkDgt', 'wcc', '금액'],
          values: ['', '', '', ''],
          expectedKeys: ['응답코드', '승인번호', 'NOTE'],
          expectedValues: ['', '', '']
        }]
      }]
    }));
  };

  const deleteScenario = (sIdx) => {
    if (!confirm('시나리오를 삭제하시겠습니까?')) return;
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.filter((_, i) => i !== sIdx)
    }));
  };

  const updateScenarioName = (sIdx, name) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? { ...s, scenarioName: name } : s
      )
    }));
  };

  const addStep = (sIdx) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? {
          ...s,
          steps: [...s.steps, s.steps.length > 0 ? {
            // 마지막 스텝 복사
            caseNo: String(parseInt(s.steps[s.steps.length - 1].caseNo || '0') + 1).padStart(4, '0'),
            priority: s.steps[s.steps.length - 1].priority,
            keys: [...s.steps[s.steps.length - 1].keys],
            values: s.steps[s.steps.length - 1].values.map(() => ''),
            expectedKeys: [...s.steps[s.steps.length - 1].expectedKeys],
            expectedValues: s.steps[s.steps.length - 1].expectedValues.map(() => '')
          } : {
            // 첫 스텝인 경우 기본값 (시나리오 추가 시 이미 생성되므로 이 케이스는 거의 사용되지 않음)
            caseNo: '0001',
            priority: '보통',
            keys: ['bin', 'chkDgt', 'wcc', '금액'],
            values: ['', '', '', ''],
            expectedKeys: ['응답코드', '승인번호', 'NOTE'],
            expectedValues: ['', '', '']
          }]
        } : s
      )
    }));
  };

  const deleteStep = (sIdx, stIdx) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? {
          ...s,
          steps: s.steps.filter((_, j) => j !== stIdx)
        } : s
      )
    }));
  };

  const updateStep = (sIdx, stIdx, field, value) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? {
          ...s,
          steps: s.steps.map((st, j) => 
            j === stIdx ? { ...st, [field]: value } : st
          )
        } : s
      )
    }));
  };

  const addKeyValue = (sIdx, stIdx, type) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? {
          ...s,
          steps: s.steps.map((st, j) => 
            j === stIdx ? {
              ...st,
              [type === 'request' ? 'keys' : 'expectedKeys']: [...(type === 'request' ? st.keys : st.expectedKeys), ''],
              [type === 'request' ? 'values' : 'expectedValues']: [...(type === 'request' ? st.values : st.expectedValues), '']
            } : st
          )
        } : s
      )
    }));
  };

  const addColumnToAllSteps = (sIdx, type) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? {
          ...s,
          steps: s.steps.map(st => ({
            ...st,
            [type === 'request' ? 'keys' : 'expectedKeys']: [...(type === 'request' ? st.keys : st.expectedKeys), ''],
            [type === 'request' ? 'values' : 'expectedValues']: [...(type === 'request' ? st.values : st.expectedValues), '']
          }))
        } : s
      )
    }));
  };

  const moveColumn = (sIdx, type, fromIdx, toIdx) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? {
          ...s,
          steps: s.steps.map(st => {
            const keysArr = type === 'request' ? [...st.keys] : [...st.expectedKeys];
            const valuesArr = type === 'request' ? [...st.values] : [...st.expectedValues];
            
            // 배열 요소 이동
            const [movedKey] = keysArr.splice(fromIdx, 1);
            keysArr.splice(toIdx, 0, movedKey);
            
            const [movedValue] = valuesArr.splice(fromIdx, 1);
            valuesArr.splice(toIdx, 0, movedValue);
            
            return {
              ...st,
              [type === 'request' ? 'keys' : 'expectedKeys']: keysArr,
              [type === 'request' ? 'values' : 'expectedValues']: valuesArr
            };
          })
        } : s
      )
    }));
  };

  const toggleStepSelection = (sIdx, stIdx, shiftKey = false) => {
    const key = `${sIdx}-${stIdx}`;
    
    if (shiftKey && lastSelectedKey) {
      // Shift+클릭: 범위 선택
      const [lastSIdx, lastStIdx] = lastSelectedKey.split('-').map(Number);
      
      // 같은 시나리오 내에서만 범위 선택
      if (lastSIdx === sIdx) {
        const start = Math.min(lastStIdx, stIdx);
        const end = Math.max(lastStIdx, stIdx);
        
        setSelectedSteps(prev => {
          const newSelection = { ...prev };
          for (let i = start; i <= end; i++) {
            newSelection[`${sIdx}-${i}`] = true;
          }
          return newSelection;
        });
      }
    } else {
      // 일반 클릭: 토글
      setSelectedSteps(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
      setLastSelectedKey(key);
    }
  };

  const batchChangePriority = (priority) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, sIdx) => ({
        ...s,
        steps: s.steps.map((st, stIdx) => {
          const key = `${sIdx}-${stIdx}`;
          if (selectedSteps[key]) {
            return { ...st, priority };
          }
          return st;
        })
      }))
    }));
    setSelectedSteps({});
    setLastSelectedKey(null);
  };

  const applyBatchUpdate = (batchData) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, sIdx) => ({
        ...s,
        steps: s.steps.map((st, stIdx) => {
          const key = `${sIdx}-${stIdx}`;
          if (!selectedSteps[key]) return st;

          if (batchData.mode === 'basic') {
            // 기본 일괄 변경
            const { targetType, targetKey, newValue } = batchData;
            const isRequest = targetType === 'request';
            const keys = isRequest ? st.keys : st.expectedKeys;
            const values = isRequest ? st.values : st.expectedValues;
            const keyIndex = keys.indexOf(targetKey);

            if (keyIndex !== -1) {
              const newValues = [...values];
              newValues[keyIndex] = newValue;
              return {
                ...st,
                [isRequest ? 'values' : 'expectedValues']: newValues
              };
            }
          } else {
            // 조건부 일괄 변경
            const { conditionType, conditionKey, conditionValue, targetType, targetKey, newValue } = batchData;
            const isCondRequest = conditionType === 'request';
            const condKeys = isCondRequest ? st.keys : st.expectedKeys;
            const condValues = isCondRequest ? st.values : st.expectedValues;
            const condKeyIndex = condKeys.indexOf(conditionKey);

            // 조건 확인
            if (condKeyIndex !== -1 && condValues[condKeyIndex] === conditionValue) {
              const isTargetRequest = targetType === 'request';
              const targetKeys = isTargetRequest ? st.keys : st.expectedKeys;
              const targetValues = isTargetRequest ? st.values : st.expectedValues;
              const targetKeyIndex = targetKeys.indexOf(targetKey);

              if (targetKeyIndex !== -1) {
                const newValues = [...targetValues];
                newValues[targetKeyIndex] = newValue;
                return {
                  ...st,
                  [isTargetRequest ? 'values' : 'expectedValues']: newValues
                };
              }
            }
          }
          return st;
        })
      }))
    }));
    setShowBatchModal(false);
    setSelectedSteps({});
    setLastSelectedKey(null);
  };

  const removeKeyValue = (sIdx, stIdx, type, kvIdx) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? {
          ...s,
          steps: s.steps.map((st, j) => 
            j === stIdx ? {
              ...st,
              [type === 'request' ? 'keys' : 'expectedKeys']: (type === 'request' ? st.keys : st.expectedKeys).filter((_, k) => k !== kvIdx),
              [type === 'request' ? 'values' : 'expectedValues']: (type === 'request' ? st.values : st.expectedValues).filter((_, k) => k !== kvIdx)
            } : st
          )
        } : s
      )
    }));
  };

  const updateKeyValue = (sIdx, stIdx, type, kvIdx, isKey, value) => {
    setForm(prev => ({
      ...prev,
      scenarios: prev.scenarios.map((s, i) => 
        i === sIdx ? {
          ...s,
          steps: s.steps.map((st, j) => 
            j === stIdx ? {
              ...st,
              [type === 'request' ? (isKey ? 'keys' : 'values') : (isKey ? 'expectedKeys' : 'expectedValues')]: 
                (type === 'request' ? (isKey ? st.keys : st.values) : (isKey ? st.expectedKeys : st.expectedValues))
                  .map((item, k) => k === kvIdx ? value : item)
            } : st
          )
        } : s
      )
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cases')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <ArrowLeft size={20} />
              목록으로
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {id && id !== 'new' ? '테스트 케이스 편집' : '새 테스트 케이스'}
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={20} />
            저장
          </button>
        </div>

        {/* Form - Compact */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">1. TEST CASE NAME:</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="테스트 케이스 이름을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">2. NOTE:</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                className="w-full px-3 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="메모를 입력하세요"
              />
            </div>
          </div>
        </div>

        {/* Scenarios */}
        <div className="space-y-4">
          {form.scenarios.map((scenario, sIdx) => (
            <div key={sIdx} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={scenario.scenarioName}
                  onChange={(e) => updateScenarioName(sIdx, e.target.value)}
                  className="text-xl font-bold px-3 py-1 border-b-2 border-transparent hover:border-blue-500 focus:border-blue-500 focus:outline-none flex-1 min-w-[200px]"
                  style={{width: 'auto'}}
                />
                <button
                  onClick={() => deleteScenario(sIdx)}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Steps Table */}
              <div className="overflow-x-auto border border-gray-300 rounded">
                <table className="border-collapse text-xs" style={{width: '100%', tableLayout: 'auto'}}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-1 py-1 w-10 text-xs sticky left-0 bg-gray-100 z-10">선택</th>
                      <th className="border border-gray-300 px-2 py-1 text-xs text-center bg-gray-100" style={{minWidth: '50px'}}>No</th>
                      <th className="border border-gray-300 px-2 py-1 text-xs text-center bg-gray-100" style={{minWidth: '60px'}}>중요도</th>
                      {/* Request Headers */}
                      {scenario.steps.length > 0 && scenario.steps[0].keys.map((_, idx) => (
                        <th key={`req-${idx}`} className="border border-gray-300 px-2 py-1 text-xs bg-blue-50">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-center gap-0.5">
                              {idx > 0 && (
                                <button
                                  onClick={() => moveColumn(sIdx, 'request', idx, idx - 1)}
                                  className="p-0 hover:bg-blue-200 rounded"
                                  title="왼쪽으로 이동"
                                >
                                  <ChevronLeft size={10} />
                                </button>
                              )}
                              {idx < scenario.steps[0].keys.length - 1 && (
                                <button
                                  onClick={() => moveColumn(sIdx, 'request', idx, idx + 1)}
                                  className="p-0 hover:bg-blue-200 rounded"
                                  title="오른쪽으로 이동"
                                >
                                  <ChevronRight size={10} />
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={scenario.steps[0].keys[idx]}
                              onChange={(e) => {
                                // Update header for all steps
                                setForm(prev => ({
                                  ...prev,
                                  scenarios: prev.scenarios.map((s, si) =>
                                    si === sIdx ? {
                                      ...s,
                                      steps: s.steps.map(st => ({
                                        ...st,
                                        keys: st.keys.map((k, ki) => ki === idx ? e.target.value : k)
                                      }))
                                    } : s
                                  )
                                }));
                              }}
                              className="px-1 py-0.5 text-[10px] border-0 bg-transparent font-semibold text-center"
                              placeholder="요청"
                              size={Math.max(Math.ceil((scenario.steps[0].keys[idx] || '').length * 1.5) + 3, 12)}
                            />
                          </div>
                        </th>
                      ))}
                      {/* Divider */}
                      <th className="border-l-4 border-gray-800 bg-gray-800 w-1 p-0"></th>
                      {/* Expected Headers */}
                      {scenario.steps.length > 0 && scenario.steps[0].expectedKeys.map((_, idx) => (
                        <th key={`exp-${idx}`} className="border border-gray-300 px-2 py-1 text-xs bg-green-50">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-center gap-0.5">
                              {idx > 0 && (
                                <button
                                  onClick={() => moveColumn(sIdx, 'expected', idx, idx - 1)}
                                  className="p-0 hover:bg-green-200 rounded"
                                  title="왼쪽으로 이동"
                                >
                                  <ChevronLeft size={10} />
                                </button>
                              )}
                              {idx < scenario.steps[0].expectedKeys.length - 1 && (
                                <button
                                  onClick={() => moveColumn(sIdx, 'expected', idx, idx + 1)}
                                  className="p-0 hover:bg-green-200 rounded"
                                  title="오른쪽으로 이동"
                                >
                                  <ChevronRight size={10} />
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={scenario.steps[0].expectedKeys[idx]}
                              onChange={(e) => {
                                // Update header for all steps
                                setForm(prev => ({
                                  ...prev,
                                  scenarios: prev.scenarios.map((s, si) =>
                                    si === sIdx ? {
                                      ...s,
                                      steps: s.steps.map(st => ({
                                        ...st,
                                        expectedKeys: st.expectedKeys.map((k, ki) => ki === idx ? e.target.value : k)
                                      }))
                                    } : s
                                  )
                                }));
                              }}
                              className="px-1 py-0.5 text-[10px] border-0 bg-transparent font-semibold text-center"
                              placeholder="기댓값"
                              size={Math.max(Math.ceil((scenario.steps[0].expectedKeys[idx] || '').length * 1.5) + 3, 12)}
                            />
                          </div>
                        </th>
                      ))}
                      <th className="border border-gray-300 px-1 py-1 w-12 text-xs">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.steps.map((step, stIdx) => (
                      <tr key={stIdx} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-1 py-0.5 text-center sticky left-0 bg-white z-10">
                          <input 
                            type="checkbox" 
                            className="cursor-pointer w-3 h-3"
                            checked={!!selectedSteps[`${sIdx}-${stIdx}`]}
                            onChange={(e) => toggleStepSelection(sIdx, stIdx, e.nativeEvent.shiftKey)}
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-0.5 text-center" style={{minWidth: '50px'}}>
                          <input
                            type="text"
                            value={step.caseNo}
                            onChange={(e) => updateStep(sIdx, stIdx, 'caseNo', e.target.value)}
                            className="w-full px-0.5 py-0.5 text-[11px] border-0 text-center"
                            style={{textAlign: 'center'}}
                          />
                        </td>
                        <td className="border border-gray-300 px-1 py-0.5" style={{minWidth: '60px', backgroundColor: 
                          step.priority === '낮음' ? '#b3e5fc' : 
                          step.priority === '높음' ? '#ffcdd2' : 
                          '#fff9c4'
                        }}>
                          <select
                            value={step.priority}
                            onChange={(e) => updateStep(sIdx, stIdx, 'priority', e.target.value)}
                            className="w-full h-full px-1 py-0.5 text-[11px] border-0 font-medium text-center"
                            style={{
                              backgroundColor: 'transparent',
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23333' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 2px center',
                              backgroundSize: '8px 8px',
                              paddingRight: '12px',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              MozAppearance: 'none'
                            }}
                          >
                            <option value="낮음">낮음</option>
                            <option value="보통">보통</option>
                            <option value="높음">높음</option>
                          </select>
                        </td>
                        {/* Request Values */}
                        {step.values.map((val, kvIdx) => (
                          <td key={`req-val-${kvIdx}`} className="border border-gray-300 px-0.5 py-0.5">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => updateKeyValue(sIdx, stIdx, 'request', kvIdx, false, e.target.value)}
                              className="px-1 py-0.5 text-[10px] border-0 bg-transparent"
                              size={Math.max(Math.ceil((val || '').length * 1.5) + 3, 15)}
                            />
                          </td>
                        ))}
                        {/* Divider */}
                        <td className="border-l-4 border-gray-800 bg-gray-800 p-0"></td>
                        {/* Expected Values */}
                        {step.expectedValues.map((val, kvIdx) => (
                          <td key={`exp-val-${kvIdx}`} className="border border-gray-300 px-0.5 py-0.5">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => updateKeyValue(sIdx, stIdx, 'expected', kvIdx, false, e.target.value)}
                              className="px-1 py-0.5 text-[10px] border-0 bg-transparent"
                              size={Math.max(Math.ceil((val || '').length * 1.5) + 3, 15)}
                            />
                          </td>
                        ))}
                        <td className="border border-gray-300 px-1 py-0.5 text-center">
                          <button
                            onClick={() => deleteStep(sIdx, stIdx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Actions */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  onClick={() => addColumnToAllSteps(sIdx, 'request')}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  + 요청 컬럼 추가
                </button>
                <button
                  onClick={() => addColumnToAllSteps(sIdx, 'expected')}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                >
                  + 기댓값 컬럼 추가
                </button>
                
                {Object.values(selectedSteps).filter(Boolean).length > 0 && (
                  <>
                    <div className="border-l border-gray-300 mx-1"></div>
                    <button
                      onClick={() => batchChangePriority('낮음')}
                      className="px-3 py-1 text-sm rounded hover:opacity-80"
                      style={{backgroundColor: '#b3e5fc'}}
                    >
                      중요도: 낮음
                    </button>
                    <button
                      onClick={() => batchChangePriority('보통')}
                      className="px-3 py-1 text-sm rounded hover:opacity-80"
                      style={{backgroundColor: '#fff9c4'}}
                    >
                      중요도: 보통
                    </button>
                    <button
                      onClick={() => batchChangePriority('높음')}
                      className="px-3 py-1 text-sm rounded hover:opacity-80"
                      style={{backgroundColor: '#ffcdd2'}}
                    >
                      중요도: 높음
                    </button>
                    <div className="border-l border-gray-300 mx-1"></div>
                  </>
                )}
                
                <button
                  onClick={() => setShowBatchModal(true)}
                  disabled={Object.values(selectedSteps).filter(Boolean).length === 0}
                  className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  일괄 변경 ({Object.values(selectedSteps).filter(Boolean).length}개 선택)
                </button>
              </div>

              <button
                onClick={() => addStep(sIdx)}
                className="w-full mt-4 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500"
              >
                + 스텝 추가
              </button>
            </div>
          ))}
        </div>

        {/* Add Scenario Button */}
        <button
          onClick={addScenario}
          className="w-full mt-6 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:border-blue-500 hover:bg-blue-50"
        >
          <Plus size={20} />
          시나리오 추가
        </button>
      </div>

      {/* Batch Update Modal */}
      {showBatchModal && (
        <BatchUpdateModal
          scenarios={form.scenarios}
          onClose={() => setShowBatchModal(false)}
          onApply={applyBatchUpdate}
        />
      )}
    </div>
  );
}

function BatchUpdateModal({ scenarios, onClose, onApply }) {
  const [mode, setMode] = useState('basic');
  const [formData, setFormData] = useState({
    targetType: 'request',
    targetKey: '',
    newValue: '',
    conditionType: 'request',
    conditionKey: '',
    conditionValue: ''
  });

  const allKeys = {
    request: new Set(),
    expected: new Set()
  };
  scenarios.forEach(s => {
    s.steps.forEach(st => {
      st.keys.forEach(k => allKeys.request.add(k));
      st.expectedKeys.forEach(k => allKeys.expected.add(k));
    });
  });

  const handleApply = () => {
    if (mode === 'basic') {
      if (!formData.targetKey || !formData.newValue) {
        alert('모든 필드를 입력해주세요.');
        return;
      }
      onApply({
        mode: 'basic',
        targetType: formData.targetType,
        targetKey: formData.targetKey,
        newValue: formData.newValue
      });
    } else {
      if (!formData.conditionKey || !formData.conditionValue || !formData.targetKey || !formData.newValue) {
        alert('모든 필드를 입력해주세요.');
        return;
      }
      onApply({
        mode: 'conditional',
        conditionType: formData.conditionType,
        conditionKey: formData.conditionKey,
        conditionValue: formData.conditionValue,
        targetType: formData.targetType,
        targetKey: formData.targetKey,
        newValue: formData.newValue
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">일괄 변경</h2>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('basic')}
              className={`px-4 py-2 rounded ${mode === 'basic' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              기본 변경
            </button>
            <button
              onClick={() => setMode('conditional')}
              className={`px-4 py-2 rounded ${mode === 'conditional' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              조건부 변경
            </button>
          </div>

          {mode === 'basic' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">변경할 필드 타입</label>
                <select
                  value={formData.targetType}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetType: e.target.value, targetKey: '' }))}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="request">요청</option>
                  <option value="expected">기댓값</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">변경할 키</label>
                <select
                  value={formData.targetKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetKey: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">키 선택</option>
                  {Array.from(formData.targetType === 'request' ? allKeys.request : allKeys.expected).map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">새 값</label>
                <input
                  type="text"
                  value={formData.newValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, newValue: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="새로운 값 입력"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">조건</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">조건 필드 타입</label>
                    <select
                      value={formData.conditionType}
                      onChange={(e) => setFormData(prev => ({ ...prev, conditionType: e.target.value, conditionKey: '' }))}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="request">요청</option>
                      <option value="expected">기댓값</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">조건 키</label>
                    <select
                      value={formData.conditionKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, conditionKey: e.target.value }))}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">키 선택</option>
                      {Array.from(formData.conditionType === 'request' ? allKeys.request : allKeys.expected).map(key => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">조건 값</label>
                    <input
                      type="text"
                      value={formData.conditionValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, conditionValue: e.target.value }))}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="조건 값 입력"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">변경할 값</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">변경할 필드 타입</label>
                    <select
                      value={formData.targetType}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetType: e.target.value, targetKey: '' }))}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="request">요청</option>
                      <option value="expected">기댓값</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">변경할 키</label>
                    <select
                      value={formData.targetKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetKey: e.target.value }))}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">키 선택</option>
                      {Array.from(formData.targetType === 'request' ? allKeys.request : allKeys.expected).map(key => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">새 값</label>
                    <input
                      type="text"
                      value={formData.newValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, newValue: e.target.value }))}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="새로운 값 입력"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              적용
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
