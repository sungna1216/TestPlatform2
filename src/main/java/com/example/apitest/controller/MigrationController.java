package com.example.apitest.controller;

import com.example.apitest.service.MigrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Controller
@RequestMapping("/migration")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class MigrationController {
    
    private final MigrationService migrationService;
    
    /**
     * 마이그레이션 관리 페이지
     */
    @GetMapping
    public String migrationPage(Model model) {
        Map<String, Object> stats = migrationService.getMigrationStats();
        model.addAttribute("stats", stats);
        return "migration";
    }
    
    /**
     * 단일 파일 마이그레이션
     * POST /migration/single?fileName=test_case_1.txt
     */
    @PostMapping("/single")
    @ResponseBody
    public ResponseEntity<?> migrateSingleFile(@RequestParam String fileName) {
        try {
            migrationService.migrateSingleFile(fileName);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "마이그레이션 성공: " + fileName
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "마이그레이션 실패: " + e.getMessage()
            ));
        }
    }
    
    /**
     * 전체 파일 마이그레이션
     * POST /migration/all
     */
    @PostMapping("/all")
    @ResponseBody
    public ResponseEntity<?> migrateAllFiles() {
        try {
            Map<String, String> results = migrationService.migrateAllFiles();
            long successCount = results.values().stream()
                .filter(v -> v.equals("SUCCESS"))
                .count();
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "totalFiles", results.size(),
                "successCount", successCount,
                "failedCount", results.size() - successCount,
                "details", results
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "전체 마이그레이션 실패: " + e.getMessage()
            ));
        }
    }
    
    /**
     * 마이그레이션 통계 조회
     * GET /migration/stats
     */
    @GetMapping("/stats")
    @ResponseBody
    public ResponseEntity<?> getStats() {
        Map<String, Object> stats = migrationService.getMigrationStats();
        return ResponseEntity.ok(stats);
    }
    
    /**
     * 특정 케이스 삭제
     * DELETE /migration/case?fileName=test_case_1.txt
     */
    @DeleteMapping("/case")
    @ResponseBody
    public ResponseEntity<?> deleteCase(@RequestParam String fileName) {
        try {
            migrationService.deleteCase(fileName);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "삭제 성공: " + fileName
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "삭제 실패: " + e.getMessage()
            ));
        }
    }
    
    /**
     * 전체 데이터 삭제 (주의!)
     * DELETE /migration/all
     */
    @DeleteMapping("/all")
    @ResponseBody
    public ResponseEntity<?> deleteAllData() {
        try {
            migrationService.deleteAllData();
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "전체 데이터 삭제 완료"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "삭제 실패: " + e.getMessage()
            ));
        }
    }
}
