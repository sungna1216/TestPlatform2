package com.example.apitest.model;

import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.LinkedHashSet;
public class ResultScenario {
    private String name;
    private List<Map<String, String>> steps;
    private Set<String> headers;

    public ResultScenario(String name, List<Map<String, String>> steps) {
        this.name = name;
        this.steps = steps;
        this.headers = extractHeaders(steps);
    }

    private Set<String> extractHeaders(List<Map<String, String>> steps) {
        Set<String> keys = new LinkedHashSet<>();
        for (Map<String, String> step : steps) {
            for (String key : step.keySet()) {
                if (!key.equals("RESULT") && !key.equals("result")) {
                    keys.add(key);
                }
            }
        }
        return keys;
    }

    public String getName() { return name; }
    public List<Map<String, String>> getSteps() { return steps; }
    public Set<String> getHeaders() { return headers; }
}
