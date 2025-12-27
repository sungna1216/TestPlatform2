import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Database } from 'lucide-react';
import { testCaseApi } from '../lib/api';
import { formatDate, cn } from '../lib/utils';

export default function CaseList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cases, setCases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 0,
    totalPages: 0,
    totalItems: 0,
  });

  const currentPage = parseInt(searchParams.get('page') || '0');
  const selectedCategory = searchParams.get('category') || '';

  useEffect(() => {
    loadCases();
  }, [currentPage, selectedCategory]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const response = await testCaseApi.getAll(currentPage, 20, selectedCategory);
      setCases(response.data.cases || []);
      setPagination({
        currentPage: response.data.currentPage || 0,
        totalPages: response.data.totalPages || 0,
        totalItems: response.data.totalItems || 0,
      });
      if (response.data.categories) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await testCaseApi.delete(id);
      loadCases();
    } catch (error) {
      console.error('Failed to delete case:', error);
      alert('삭제 실패');
    }
  };

  const handleCategoryChange = (category) => {
    setSearchParams({ page: '0', category });
  };

  const handlePageChange = (page) => {
    setSearchParams({ page: page.toString(), category: selectedCategory });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">📊 테스트 케이스 관리 (React)</h1>
          <button
            onClick={() => navigate('/new')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus size={20} />
            새 케이스 생성
          </button>
        </div>

        {/* Stats */}
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <strong>총 케이스:</strong> {pagination.totalItems}개 | 
          <strong className="ml-4">페이지:</strong> {pagination.currentPage + 1} / {pagination.totalPages}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <label className="font-semibold">카테고리:</label>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">전체</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button
            onClick={() => navigate('/migration')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Database size={18} />
            마이그레이션
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left w-20">ID</th>
                  <th className="px-4 py-3 text-left">제목</th>
                  <th className="px-4 py-3 text-left w-32">카테고리</th>
                  <th className="px-4 py-3 text-left w-24">버전</th>
                  <th className="px-4 py-3 text-left w-24">상태</th>
                  <th className="px-4 py-3 text-left w-40">수정일</th>
                  <th className="px-4 py-3 text-left w-48">작업</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-gray-500">
                      📭 등록된 테스트 케이스가 없습니다.
                    </td>
                  </tr>
                ) : (
                  cases.map((testCase) => (
                    <tr key={testCase.caseId} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{testCase.caseId}</td>
                      <td className="px-4 py-3">
                        <strong>{testCase.title}</strong>
                        {testCase.note && (
                          <div className="text-sm text-gray-600">{testCase.note}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{testCase.category || '-'}</td>
                      <td className="px-4 py-3">v{testCase.versionNumber}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-bold",
                          testCase.versionStatus === 'PUBLISHED' 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        )}>
                          {testCase.versionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(testCase.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/edit/${testCase.caseId}`)}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Edit size={16} />
                            편집
                          </button>
                          <button
                            onClick={() => handleDelete(testCase.caseId)}
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            <Trash2 size={16} />
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {pagination.currentPage > 0 && (
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                « 이전
              </button>
            )}
            
            {[...Array(pagination.totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i)}
                className={cn(
                  "px-4 py-2 border rounded",
                  i === pagination.currentPage
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100"
                )}
              >
                {i + 1}
              </button>
            ))}

            {pagination.currentPage < pagination.totalPages - 1 && (
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                다음 »
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
