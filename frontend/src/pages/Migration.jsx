import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, FileText, RefreshCw, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { migrationApi } from '../lib/api';
import { cn } from '../lib/utils';

export default function Migration() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [selectedFile, setSelectedFile] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await migrationApi.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateSingle = async () => {
    if (!selectedFile.trim()) {
      alert('파일명을 입력해주세요 (예: test_case_1.txt)');
      return;
    }

    if (!confirm(`${selectedFile}을(를) 마이그레이션하시겠습니까?`)) return;

    try {
      setMigrating(true);
      const response = await migrationApi.migrateSingle(selectedFile);
      setResults({
        type: 'single',
        success: response.data.success,
        message: response.data.message
      });
      loadStats();
      setSelectedFile('');
    } catch (error) {
      setResults({
        type: 'single',
        success: false,
        message: error.response?.data?.message || '마이그레이션 실패'
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleMigrateAll = async () => {
    if (!confirm('모든 txt 파일을 DB로 마이그레이션하시겠습니까?\n시간이 오래 걸릴 수 있습니다.')) return;

    try {
      setMigrating(true);
      const response = await migrationApi.migrateAll();
      setResults({
        type: 'all',
        success: response.data.success,
        totalFiles: response.data.totalFiles,
        successCount: response.data.successCount,
        failedCount: response.data.failedCount,
        details: response.data.details
      });
      loadStats();
    } catch (error) {
      setResults({
        type: 'all',
        success: false,
        message: error.response?.data?.message || '전체 마이그레이션 실패'
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleDeleteCase = async (fileName) => {
    if (!confirm(`${fileName} DB 데이터를 삭제하시겠습니까?`)) return;

    try {
      await migrationApi.deleteCase(fileName);
      alert('삭제되었습니다');
      loadStats();
    } catch (error) {
      alert('삭제 실패: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteAll = async () => {
    const confirmText = prompt(
      '⚠️ 경고: 모든 DB 데이터가 삭제됩니다!\n계속하려면 "DELETE"를 입력하세요:'
    );
    
    if (confirmText !== 'DELETE') {
      alert('취소되었습니다');
      return;
    }

    try {
      setLoading(true);
      await migrationApi.deleteAll();
      alert('전체 데이터가 삭제되었습니다');
      loadStats();
    } catch (error) {
      alert('삭제 실패: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
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
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Database size={32} />
              데이터 마이그레이션
            </h1>
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">txt 파일</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.totalTxtFiles || 0}</p>
                </div>
                <FileText size={40} className="text-blue-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">DB 케이스</p>
                  <p className="text-3xl font-bold text-green-600">{stats.totalDbCases || 0}</p>
                </div>
                <Database size={40} className="text-green-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">시나리오</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.totalDbScenarios || 0}</p>
                </div>
                <CheckCircle size={40} className="text-purple-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">스텝</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.totalDbSteps || 0}</p>
                </div>
                <CheckCircle size={40} className="text-orange-400" />
              </div>
            </div>
          </div>
        )}

        {/* Migration Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Single File Migration */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText size={24} />
              단일 파일 마이그레이션
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              output 디렉토리의 특정 txt 파일을 DB로 마이그레이션합니다.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                placeholder="예: test_case_1.txt"
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={handleMigrateSingle}
                disabled={migrating}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {migrating ? '처리중...' : '마이그레이션'}
              </button>
            </div>
          </div>

          {/* All Files Migration */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Database size={24} />
              전체 파일 마이그레이션
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              output 디렉토리의 모든 txt 파일을 DB로 마이그레이션합니다.
            </p>
            <button
              onClick={handleMigrateAll}
              disabled={migrating}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
            >
              {migrating ? '마이그레이션 중...' : '전체 마이그레이션 시작'}
            </button>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className={cn(
            "rounded-lg shadow-md p-6 mb-6",
            results.success ? "bg-green-50 border-2 border-green-500" : "bg-red-50 border-2 border-red-500"
          )}>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              {results.success ? (
                <>
                  <CheckCircle size={24} className="text-green-600" />
                  <span className="text-green-800">마이그레이션 성공</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={24} className="text-red-600" />
                  <span className="text-red-800">마이그레이션 실패</span>
                </>
              )}
            </h3>

            {results.type === 'single' && (
              <p className="text-sm">{results.message}</p>
            )}

            {results.type === 'all' && results.success && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-sm text-gray-600">총 파일</p>
                    <p className="text-2xl font-bold">{results.totalFiles}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">성공</p>
                    <p className="text-2xl font-bold text-green-600">{results.successCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">실패</p>
                    <p className="text-2xl font-bold text-red-600">{results.failedCount}</p>
                  </div>
                </div>

                {results.details && Object.keys(results.details).length > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer font-semibold">상세 결과 보기</summary>
                    <div className="mt-2 max-h-60 overflow-y-auto bg-white rounded p-3">
                      {Object.entries(results.details).map(([file, status]) => (
                        <div key={file} className="flex justify-between py-1 border-b text-sm">
                          <span>{file}</span>
                          <span className={status === 'SUCCESS' ? 'text-green-600 font-semibold' : 'text-red-600'}>
                            {status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Danger Zone */}
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={24} />
            위험 구역 (Danger Zone)
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            ⚠️ 아래 작업은 되돌릴 수 없습니다. 신중하게 사용하세요!
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleDeleteAll}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
            >
              <Trash2 size={20} />
              전체 DB 데이터 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
