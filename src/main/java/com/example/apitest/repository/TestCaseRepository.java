package com.example.apitest.repository;

import com.example.apitest.entity.TestCaseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCaseEntity, Long> {
    
    /**
     * 파일명으로 조회
     */
    Optional<TestCaseEntity> findByFileName(String fileName);
    
    /**
     * 버전 상태로 조회
     */
    Page<TestCaseEntity> findByVersionStatus(String versionStatus, Pageable pageable);
    
    /**
     * 카테고리로 조회
     */
    Page<TestCaseEntity> findByCategory(String category, Pageable pageable);
    
    /**
     * 카테고리 + 버전 상태로 조회
     */
    Page<TestCaseEntity> findByCategoryAndVersionStatus(
        String category, String versionStatus, Pageable pageable
    );
    
    /**
     * 제목으로 검색 (LIKE)
     */
    @Query("SELECT tc FROM TestCaseEntity tc WHERE tc.title LIKE %:keyword%")
    Page<TestCaseEntity> searchByTitle(@Param("keyword") String keyword, Pageable pageable);
    
    /**
     * 날짜 범위로 조회
     */
    @Query("SELECT tc FROM TestCaseEntity tc " +
           "WHERE tc.updatedAt BETWEEN :from AND :to " +
           "ORDER BY tc.updatedAt DESC")
    Page<TestCaseEntity> findByDateRange(
        @Param("from") LocalDateTime from, 
        @Param("to") LocalDateTime to, 
        Pageable pageable
    );
    
    /**
     * 활성화된 케이스만 조회
     */
    @Query("SELECT tc FROM TestCaseEntity tc WHERE tc.isActive = 'Y' AND tc.versionStatus = :status")
    Page<TestCaseEntity> findActiveByStatus(@Param("status") String status, Pageable pageable);
    
    /**
     * 파일명 존재 여부 확인
     */
    boolean existsByFileName(String fileName);
    
    /**
     * 카테고리 목록 조회 (중복 제거)
     */
    @Query("SELECT DISTINCT tc.category FROM TestCaseEntity tc WHERE tc.category IS NOT NULL")
    List<String> findAllCategories();
}
