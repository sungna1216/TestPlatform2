package com.example.apitest.model;

import java.util.Map;

public class StepResult {
    private String result; // "OK" or "FAIL"
    private Map<String, String> fields;

    public StepResult(String result, Map<String, String> fields) {
        this.result = result;
        this.fields = fields;
    }

    public String getResult() {
        return result;
    }

    public Map<String, String> getFields() {
        return fields;
    }
}
