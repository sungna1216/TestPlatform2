package com.example.apitest.model;

import java.util.Map;

public class StepPair {
    private Map<String, String> input;
    private Map<String, String> output;

    public StepPair(Map<String, String> input, Map<String, String> output) {
        this.input = input;
        this.output = output;
    }

    public Map<String, String> getInput() {
        return input;
    }

    public Map<String, String> getOutput() {
        return output;
    }
}
