package com.example.apitest.util;

import com.example.apitest.model.TestScenario;
import com.example.apitest.model.TestStep;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

public class TestCaseFileParser {

    private static final ObjectMapper mapper = new ObjectMapper();

    public static List<TestScenario> parseTestCaseFile(Path inputPath) {
        List<TestScenario> scenarios = new ArrayList<>();

        try {
            List<String> lines = Files.readAllLines(inputPath, StandardCharsets.UTF_8);
            String currentScenarioName = null;
            StringBuilder jsonBlock = null;

            for (String line : lines) {
                line = line.trim();

                if (line.startsWith("TEST CASE START :")) {
                    if (jsonBlock != null && currentScenarioName != null) {
                        parseScenarioBlock(currentScenarioName, jsonBlock.toString(), scenarios);
                    }
                    currentScenarioName = line.substring("TEST CASE START :".length()).trim();
                    jsonBlock = new StringBuilder();
                } else if (line.equals("TEST CASE END")) {
                    if (jsonBlock != null && currentScenarioName != null) {
                        parseScenarioBlock(currentScenarioName, jsonBlock.toString(), scenarios);
                    }
                    break;
                } else if (line.startsWith("#")) {
                    continue;
                } else {
                    if (jsonBlock != null) {
                        jsonBlock.append(line);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️ 파일 파싱 실패: " + e.getMessage());
        }

        return scenarios;
    }
    public static String extractTitle(Path path) throws IOException {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        for (String line : lines) {
            if (line.startsWith("1.TEST CASE NAME")) {
                return line.substring(line.indexOf(":") + 1).trim();
            }
        }
        return "";
    }
    public static String extractNote(Path path) throws IOException {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        StringBuilder note = new StringBuilder();
        boolean foundNote = false;
        for (String line : lines) {
            if (line.startsWith("2.NOTE")) {
                foundNote = true;
                continue;
            }
            if (foundNote && line.startsWith("TEST CASE START")) {
                break;
            }
            if (foundNote) {
                note.append(line).append("\n");
            }
        }
        return note.toString().trim();
    }
    private static void parseScenarioBlock(String scenarioName, String jsonText, List<TestScenario> scenarios) {
        try {
            jsonText = jsonText.replaceAll(",\\s*\\]", "]");
            Map<String, List<Map<String, Object>>> rawMap = mapper.readValue(jsonText,
                    new TypeReference<Map<String, List<Map<String, Object>>>>() {});
            List<Map<String, Object>> rawSteps = rawMap.get(scenarioName);
            if (rawSteps == null || rawSteps.size() % 2 != 0) return;

            List<TestStep> steps = new ArrayList<>();
            for (int i = 0; i < rawSteps.size(); i += 2) {
                Map<String, Object> request = rawSteps.get(i);
                Map<String, Object> expected = rawSteps.get(i + 1);

                TestStep step = new TestStep();
                step.setKeys(new ArrayList<>());
                step.setValues(new ArrayList<>());
                step.setExpectedKeys(new ArrayList<>());
                step.setExpectedValues(new ArrayList<>());

                // caseNo 설정 (request 기준)
                if (request.containsKey("caseNo")) {
                    step.setCaseNo(String.valueOf(request.get("caseNo")));
                }
                // priority
                String priority = null;
                if (request.containsKey("priority")) {
                    priority = String.valueOf(request.get("priority"));
                } else if (expected.containsKey("priority")) {
                    priority = String.valueOf(expected.get("priority"));
                }
                step.setPriority(priority != null ? priority : "보통");
                for (Map.Entry<String, Object> e : request.entrySet()) {
                    if (!"caseNo".equals(e.getKey()) && !"priority".equals(e.getKey())) {
                        step.getKeys().add(e.getKey());
                        step.getValues().add(String.valueOf(e.getValue()));
                    }
                }

                for (Map.Entry<String, Object> e : expected.entrySet()) {
                    if (!"caseNo".equals(e.getKey()) && !"priority".equals(e.getKey())) {
                        step.getExpectedKeys().add(e.getKey());
                        step.getExpectedValues().add(String.valueOf(e.getValue()));
                    }
                }

                steps.add(step);
            }

            TestScenario scenario = new TestScenario();
            scenario.setScenarioName(scenarioName);
            scenario.setSteps(steps);
            scenarios.add(scenario);
        } catch (Exception e) {
            System.err.println("⚠️ 시나리오 파싱 실패: " + scenarioName);
        }
    }
}
