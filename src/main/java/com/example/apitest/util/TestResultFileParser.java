package com.example.apitest.util;

import com.example.apitest.model.ResultScenario;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.*;
import java.util.*;
public class TestResultFileParser {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static List<ResultScenario> parse(File file) throws IOException {
        List<ResultScenario> scenarios = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            String currentScenarioName = null;

            while ((line = reader.readLine()) != null) {
                if (line.startsWith("TEST RESULT START :")) {
                    currentScenarioName = line.split(":", 2)[1].trim();
                } else if (line.trim().startsWith("{") && currentScenarioName != null) {
                    StringBuilder jsonBlock = new StringBuilder();
                    jsonBlock.append(line).append("\n");

                    while ((line = reader.readLine()) != null) {
                        jsonBlock.append(line).append("\n");
                        if (line.trim().endsWith("]}")) break;
                    }

                    Map<String, List<Map<String, String>>> parsed =
                            objectMapper.readValue(jsonBlock.toString(), new TypeReference<Map<String, List<Map<String, String>>>>() {});
                    List<Map<String, String>> steps = parsed.get(currentScenarioName);
                    scenarios.add(new ResultScenario(currentScenarioName, steps));
                }
            }
        }

        return scenarios;
    }
}
