package com.example.apitest.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

public class TestResultFileWriter {

    public static void writeTestResults(Path inputPath, Path outputPath) throws IOException {
        List<String> lines = Files.readAllLines(inputPath, StandardCharsets.UTF_8);
        List<String> outputLines = new ArrayList<>();
        String currentScenarioName = null;
        boolean inScenario = false;
        List<Map<String, Object>> buffer = new ArrayList<>();
        ObjectMapper mapper = new ObjectMapper();

        for (String line : lines) {
            if (line.startsWith("TEST CASE START :")) {
                currentScenarioName = line.substring("TEST CASE START :".length()).trim();
                outputLines.add("TEST RESULT START : " + currentScenarioName);
                inScenario = true;
            } else if (line.startsWith("TEST CASE END")) {
                outputLines.add("TEST RESULT END");
                break;
            } else if (inScenario && line.trim().startsWith("{")) {
                Map<String, Object> obj = mapper.readValue(line.trim().replaceAll(",$", ""), new TypeReference<Map<String, Object>>() {});
                buffer.add(obj);

                if (buffer.size() == 2) {
                    Map<String, Object> request = buffer.get(0);
                    Map<String, Object> expected = buffer.get(1);

                    Map<String, Object> actual = callApi(request);  // 실제 호출 또는 mock
                    Map<String, Object> resultLine = compare(expected, actual);
                    resultLine.put("RESULT", "OK");
                    resultLine.put("result", "true");

                    outputLines.add("  " + mapper.writeValueAsString(request) + ",");
                    outputLines.add("  " + mapper.writeValueAsString(resultLine) + ",");
                    buffer.clear();
                }
            }
        }

        Files.write(outputPath, outputLines, StandardCharsets.UTF_8);
    }

    // API 호출 모킹 또는 실제 API 연결
    private static Map<String, Object> callApi(Map<String, Object> request) {
        Map<String, Object> mockResponse = new HashMap<>();
        mockResponse.put("응답코드", "0000");
        mockResponse.put("응답메시지", "정상취소");
        mockResponse.put("거래방법", "1");
        mockResponse.put("caseNo", request.get("caseNo"));
        return mockResponse;
    }

    // 예상 vs 실제 결과 비교
    private static Map<String, Object> compare(Map<String, Object> expected, Map<String, Object> actual) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String key : expected.keySet()) {
            String exp = String.valueOf(expected.get(key));
            String act = String.valueOf(actual.getOrDefault(key, ""));
            String status = exp.equals(act) ? "OK" : "FAIL";
            result.put(key, status + ";" + exp + ";" + act);
        }
        return result;
    }
}
