package com.example.apitest.model;

import java.util.List;

public class TestScenario {
    private String scenarioName;

    public String getScenarioName() {
        return scenarioName;
    }

    public void setScenarioName(String scenarioName) {
        this.scenarioName = scenarioName;
    }

    public List<TestStep> getSteps() {
        return steps;
    }

    public void setSteps(List<TestStep> steps) {
        this.steps = steps;
    }

    private List<TestStep> steps;

    // getters, setters
}
