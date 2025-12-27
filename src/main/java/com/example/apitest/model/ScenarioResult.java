package com.example.apitest.model;

import java.util.List;

public class ScenarioResult {
    private List<String> headers;
    private List<StepResult> steps;

    public ScenarioResult(List<String> headers, List<StepResult> steps) {
        this.headers = headers;
        this.steps = steps;
    }

    public List<String> getHeaders() {
        return headers;
    }

    public List<StepResult> getSteps() {
        return steps;
    }
}
