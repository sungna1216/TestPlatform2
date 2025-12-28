import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Pause, Play, ChevronLeft } from 'lucide-react';

function TestResultView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { executionId, caseTitle, caseNote, parallelExecution } = location.state || {};
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  useEffect(() => {
    if (!executionId) {
      navigate('/');
      return;
    }

    const pollInterval = setInterval(() => {
      fetchResult();
    }, 500);

    return () => clearInterval(pollInterval);
  }, [executionId]);

  const fetchResult = async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/test-execution/${executionId}`);
      const data = await response.json();
      setResult(data);
      
      if (data.status === 'COMPLETED' || data.status === 'PAUSED') {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching result:', error);
    }
  };

  const handlePause = async () => {
    try {
      await fetch(`http://localhost:8080/api/test-execution/${executionId}/pause`, {
        method: 'POST'
      });
      setIsPaused(true);
    } catch (error) {
      console.error('Error pausing execution:', error);
    }
  };

  const handleResume = async () => {
    try {
      await fetch(`http://localhost:8080/api/test-execution/${executionId}/resume`, {
        method: 'POST'
      });
      setIsPaused(false);
      setLoading(true);
    } catch (error) {
      console.error('Error resuming execution:', error);
    }
  };

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">테스트 실행 중...</p>
        </div>
      </div>
    );
  }

  const progressPercentage = result.totalSteps > 0 
    ? (result.completedSteps / result.totalSteps) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <ChevronLeft size={20} />
              목록으로
            </button>
            <h1 className="text-3xl font-bold text-gray-900">테스트 실행 결과</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {result.status === 'RUNNING' && (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                <Pause size={20} />
                일시정지
              </button>
            )}
            {result.status === 'PAUSED' && (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <Play size={20} />
                재개
              </button>
            )}
          </div>
        </div>

        {/* Test Case Info */}
        {(caseTitle || caseNote || parallelExecution !== undefined) && (
          <div className="mb-6 bg-white p-4 rounded shadow">
            <div className="grid grid-cols-3 gap-4">
              {caseTitle && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-600">TEST CASE NAME:</label>
                  <div className="text-sm font-medium">{caseTitle}</div>
                </div>
              )}
              {caseNote && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-600">NOTE:</label>
                  <div className="text-sm">{caseNote}</div>
                </div>
              )}
              {parallelExecution !== undefined && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-600">실행 모드:</label>
                  <div className="text-sm">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      parallelExecution 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {parallelExecution ? '병렬 실행' : '순차 실행'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {(result.status === 'RUNNING' || result.status === 'PAUSED') && (
          <div className="mb-6 bg-white p-4 rounded shadow">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">
                진행률: {result.completedSteps} / {result.totalSteps} 
                ({progressPercentage.toFixed(1)}%)
              </span>
              <span className="text-sm">
                성공: <span className="text-green-600 font-bold">{result.passedSteps}</span> / 
                실패: <span className="text-red-600 font-bold">{result.failedSteps}</span>
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Summary */}
        {result.status === 'COMPLETED' && (
          <div className="mb-6 bg-white p-4 rounded shadow">
            <h2 className="text-xl font-bold mb-2">실행 완료</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{result.totalSteps}</div>
                <div className="text-sm text-gray-600">총 케이스</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.passedSteps}</div>
                <div className="text-sm text-gray-600">성공</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result.failedSteps}</div>
                <div className="text-sm text-gray-600">실패</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {result.totalSteps > 0 ? ((result.passedSteps / result.totalSteps) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-sm text-gray-600">성공률</div>
              </div>
            </div>
          </div>
        )}

        {/* Results by Scenario */}
        {result.scenarioResults && result.scenarioResults.map((scenario, sIdx) => (
          <div key={sIdx} className="mb-6 bg-white p-4 rounded shadow">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              {scenario.scenarioName}
              {scenario.status === 'RUNNING' && (
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">실행 중</span>
              )}
              {scenario.status === 'COMPLETED' && (
                <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">완료</span>
              )}
            </h3>

            {scenario.stepResults && scenario.stepResults.length > 0 && (
              <div className="overflow-x-auto border border-gray-300 rounded">
                <table className="border-collapse text-xs" style={{width: '100%', tableLayout: 'auto'}}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-xs text-center" style={{minWidth: '50px'}}>No</th>
                      <th className="border border-gray-300 px-2 py-1 text-xs text-center" style={{minWidth: '60px'}}>중요도</th>
                      <th className="border border-gray-300 px-2 py-1 text-xs text-center" style={{minWidth: '60px'}}>상태</th>
                      
                      {/* Request field names */}
                      {scenario.stepResults[0] && scenario.stepResults[0].requestData && 
                        Object.keys(scenario.stepResults[0].requestData).map((fieldName, idx) => (
                          <th key={`req-${idx}`} className="border border-gray-300 px-2 py-1 text-xs text-center bg-blue-50">
                            {fieldName}
                          </th>
                        ))
                      }
                      
                      {/* Divider */}
                      <th className="border-l-4 border-gray-800 bg-gray-800 w-1 p-0"></th>
                      
                      {/* Expected field names */}
                      {scenario.stepResults[0] && scenario.stepResults[0].fieldComparisons && 
                        Object.keys(scenario.stepResults[0].fieldComparisons).map((fieldName, idx) => (
                          <th key={`exp-${idx}`} className="border border-gray-300 px-2 py-1 text-xs text-center bg-green-50">
                            {fieldName}
                          </th>
                        ))
                      }
                      
                      <th className="border border-gray-300 px-2 py-1 text-xs text-center" style={{minWidth: '120px'}}>실행시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.stepResults.map((step, stIdx) => (
                      <tr key={stIdx} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-1 text-center">{step.caseNo}</td>
                        <td className="border border-gray-300 px-1 py-1" style={{
                          backgroundColor: 
                            step.priority === '낮음' ? '#b3e5fc' : 
                            step.priority === '높음' ? '#ffcdd2' : 
                            '#fff9c4'
                        }}>
                          <div className="text-center text-[11px] font-medium">{step.priority}</div>
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          {step.status === 'PASS' && (
                            <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">PASS</span>
                          )}
                          {step.status === 'FAIL' && (
                            <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">FAIL</span>
                          )}
                          {step.status === 'RUNNING' && (
                            <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">실행중</span>
                          )}
                        </td>
                        
                        {/* Request field values */}
                        {step.requestData && Object.entries(step.requestData).map(([fieldName, value], idx) => (
                          <td key={`req-${idx}`} className="border border-gray-300 px-1 py-1">
                            <div className="text-center text-[11px]">{value}</div>
                          </td>
                        ))}
                        
                        {/* Divider */}
                        <td className="border-l-4 border-gray-800 bg-gray-800 p-0"></td>
                        
                        {/* Expected field comparisons */}
                        {step.fieldComparisons && Object.entries(step.fieldComparisons).map(([fieldName, comparison], idx) => (
                          <td 
                            key={idx} 
                            className="border border-gray-300 px-1 py-1"
                            style={{
                              backgroundColor: comparison.match ? '#c8e6c9' : '#ffcdd2'
                            }}
                          >
                            {comparison.match ? (
                              <div className="text-center text-[11px]">{comparison.actualValue}</div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <div className="text-[10px] text-gray-600 border-b border-gray-400 pb-0.5 mb-0.5 w-full text-center">
                                  기댓값: {comparison.expectedValue}
                                </div>
                                <div className="text-[10px] text-gray-800 w-full text-center">
                                  실제값: {comparison.actualValue}
                                </div>
                              </div>
                            )}
                          </td>
                        ))}
                        
                        <td className="border border-gray-300 px-2 py-1 text-center text-[11px]">
                          <div>{formatTimestamp(step.executionTimestamp)}</div>
                          <div className="text-[10px] text-gray-500">({step.executionTime}ms)</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TestResultView;
