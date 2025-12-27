package com.example.apitest.controller.api;

import com.example.apitest.entity.TestCaseEntity;
import com.example.apitest.model.TestForm;
import com.example.apitest.service.TestCaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cases")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class TestCaseRestController {
    
    private final TestCaseService testCaseService;
    
    /**
     * 케이스 목록 조회 (JSON)
     * GET /api/cases?page=0&size=20&category=기타
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getCases(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String category) {
        
        Page<TestCaseEntity> casePage;
        
        if (category != null && !category.isEmpty()) {
            List<TestCaseEntity> filtered = testCaseService.getCasesByCategory(category);
            casePage = new org.springframework.data.domain.PageImpl<>(
                filtered,
                PageRequest.of(page, size),
                filtered.size()
            );
        } else {
            casePage = testCaseService.getAllCases(PageRequest.of(page, size));
        }
        
        List<String> categories = testCaseService.getAllCategories();
        
        Map<String, Object> response = new HashMap<>();
        response.put("cases", casePage.getContent());
        response.put("currentPage", page);
        response.put("totalPages", casePage.getTotalPages());
        response.put("totalItems", casePage.getTotalElements());
        response.put("categories", categories);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * 단일 케이스 조회 (JSON)
     * GET /api/cases/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getCase(@PathVariable Long id) {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("form", testCaseService.getCaseAsForm(id));
            response.put("caseId", id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 케이스 삭제 (JSON)
     * DELETE /api/cases/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteCase(@PathVariable Long id) {
        try {
            testCaseService.deleteCase(id);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "삭제되었습니다");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 케이스 생성 (JSON)
     * POST /api/cases
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createCase(@RequestBody TestForm form) {
        try {
            TestCaseEntity created = testCaseService.createCase(form);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("id", created.getCaseId());
            response.put("message", "저장되었습니다");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 케이스 수정 (JSON)
     * PUT /api/cases/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateCase(@PathVariable Long id, @RequestBody TestForm form) {
        try {
            testCaseService.updateCase(id, form);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("id", id);
            response.put("message", "수정되었습니다");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
