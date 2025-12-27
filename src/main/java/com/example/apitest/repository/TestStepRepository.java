package com.example.apitest.repository;

import com.example.apitest.entity.TestStepEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestStepRepository extends JpaRepository<TestStepEntity, Long> {
    
    /**
     * 특정 시나리오의 모든 스텝 조회 (순서대로)
     */
    @Query("SELECT s FROM TestStepEntity s " +
           "WHERE s.scenario.scenarioId = :scenarioId " +
           "ORDER BY s.stepOrder ASC")
    List<TestStepEntity> findByScenarioIdOrderByStepOrder(@Param("scenarioId") Long scenarioId);
    
    /**
     * 케이스 번호로 검색
     */
    Page<TestStepEntity> findByCaseNo(String caseNo, Pageable pageable);
    
    /**
     * 우선순위로 검색
     */
    @Query("SELECT s FROM TestStepEntity s " +
           "JOIN s.scenario sc " +
           "JOIN sc.testCase tc " +
           "WHERE s.priority = :priority " +
           "AND tc.versionStatus = 'PUBLISHED' " +
           "ORDER BY s.stepId")
    Page<TestStepEntity> findByPriority(@Param("priority") String priority, Pageable pageable);
    
    // 정규화 컬럼이 제거되어 아래 메서드들은 사용 불가
    // 동적 필드 검색은 TEST_SEARCH_INDEX 테이블 또는 JSON 쿼리 사용 필요
    
    /*
    // 거래방법 검색 - 정규화 컬럼 제거됨
    Page<TestStepEntity> findByTransactionType(String type, Pageable pageable);
    
    // 응답코드 검색 - 정규화 컬럼 제거됨
    Page<TestStepEntity> findByExpectedResponseCode(String code, Pageable pageable);
    
    // 취소여부 검색 - 정규화 컬럼 제거됨
    Page<TestStepEntity> findByCancelYn(String yn, Pageable pageable);
    
    // 복합 조건 검색 - 정규화 컬럼 제거됨
    Page<TestStepEntity> findByTypeAndCode(String type, String code, Pageable pageable);
    
    // 고급 검색 - 정규화 컬럼 제거됨
    Page<TestStepEntity> searchAdvanced(String type, String code, String priority, String category, Pageable pageable);
    */
    
    /**
     * 특정 케이스의 스텝 개수
     */
    @Query("SELECT COUNT(s) FROM TestStepEntity s " +
           "WHERE s.scenario.testCase.caseId = :caseId")
    long countByCaseId(@Param("caseId") Long caseId);
    
    /**
     * 특정 시나리오의 스텝 개수
     */
    long countByScenario_ScenarioId(Long scenarioId);
}
