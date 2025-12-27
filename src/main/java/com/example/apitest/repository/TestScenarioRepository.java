package com.example.apitest.repository;

import com.example.apitest.entity.TestScenarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestScenarioRepository extends JpaRepository<TestScenarioEntity, Long> {
    
    /**
     * 특정 케이스의 모든 시나리오 조회 (순서대로)
     */
    @Query("SELECT s FROM TestScenarioEntity s " +
           "WHERE s.testCase.caseId = :caseId " +
           "ORDER BY s.scenarioOrder ASC")
    List<TestScenarioEntity> findByCaseIdOrderByScenarioOrder(@Param("caseId") Long caseId);
    
    /**
     * 시나리오명으로 검색
     */
    @Query("SELECT s FROM TestScenarioEntity s WHERE s.scenarioName LIKE %:keyword%")
    List<TestScenarioEntity> searchByScenarioName(@Param("keyword") String keyword);
    
    /**
     * 특정 케이스의 시나리오 개수
     */
    long countByTestCase_CaseId(Long caseId);
}
