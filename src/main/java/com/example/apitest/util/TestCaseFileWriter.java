package com.example.apitest.util;

import com.example.apitest.model.TestForm;
import com.example.apitest.model.TestScenario;
import com.example.apitest.model.TestStep;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

public class TestCaseFileWriter {

    public static void writeTestCaseFile(TestForm form, String fileName) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);

        List<String> lines = new ArrayList<>();
        int caseNumber = 1;

        // 1. HEADER
        lines.add("1.TEST CASE NAME : " + form.getTitle());
        lines.add("2.NOTE");
        if (form.getNote() != null && !form.getNote().isEmpty()) {
            Arrays.stream(form.getNote().split("\\r?\\n"))
                    .forEach(lines::add);
        }

        // 2. 시나리오별 저장
        for (TestScenario scenario : form.getScenarios()) {
            List<TestStep> steps = scenario.getSteps();
            if (steps == null || steps.isEmpty()) {
                continue; // steps가 null이거나 비어있으면 skip
            }
            // 스텝 필터링: 요청 필드가 없는 빈 스텝 제외
            List<TestStep> validSteps = scenario.getSteps().stream()
                    .filter(s -> {
                        List<String> keys = s.getKeys();
                        List<String> expectedKeys = s.getExpectedKeys();
                        return (keys != null && !keys.isEmpty()) ||
                                (expectedKeys != null && !expectedKeys.isEmpty());
                    })
                    .collect(Collectors.toList());
            if (validSteps.isEmpty()) continue;

            lines.add("TEST CASE START : " + scenario.getScenarioName());
            lines.add("{\"" + scenario.getScenarioName() + "\":[");

            List<String> stepLines = new ArrayList<>();
            for (TestStep step : validSteps) {
                String caseNo = String.format("%04d", caseNumber++);

                Map<String, Object> request = new LinkedHashMap<>();
                Map<String, Object> expected = new LinkedHashMap<>();
                request.put("caseNo", caseNo);
                expected.put("caseNo", caseNo);

                if (step.getKeys() != null && step.getValues() != null) {
                    for (int i = 0; i < step.getKeys().size(); i++) {
                        String key = step.getKeys().get(i);
                        String value = step.getValues().get(i);
                        if (key != null && !key.trim().isEmpty()) {
                            request.put(key, value);
                        }
                    }
                }

                if (step.getExpectedKeys() != null && step.getExpectedValues() != null) {
                    for (int i = 0; i < step.getExpectedKeys().size(); i++) {
                        String key = step.getExpectedKeys().get(i);
                        String value = step.getExpectedValues().get(i);
                        if (key != null && !key.trim().isEmpty()) {
                            expected.put(key, value);
                        }
                    }
                }
                String priority = step.getPriority() != null ? step.getPriority() : "보통";
                request.put("priority", priority);
                expected.put("priority", priority);
                stepLines.add("  " + mapper.writeValueAsString(request));
                stepLines.add("  " + mapper.writeValueAsString(expected));
            }

//            for (int i = 0; i < stepLines.size(); i++) {
//              lines.add(stepLines.get(i) + (i < stepLines.size() - 1 ? "," : ""));
//          }
                for (int i = 0; i < stepLines.size(); i++) {
                String line = stepLines.get(i);
                // 마지막 줄이 아니거나, 마지막 줄인데 쉼표로 끝나지 않으면 쉼표 추가
                if (i < stepLines.size() - 1 || !line.trim().endsWith("},")) {
                    line += ",";
                }
                lines.add(line);
    }

            lines.add("]}");
        }

        lines.add("TEST CASE END");

        Path path = Paths.get("output", fileName);
        Files.createDirectories(path.getParent());
        Files.write(path, lines, StandardCharsets.UTF_8);
    }
}
