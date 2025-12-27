package com.example.apitest.model;

import java.util.*;

public class ResultScenarioWithPairs {
    private String name;
    private List<StepPair> stepPairs;

    public ResultScenarioWithPairs(String name, List<Map<String, String>> steps) {
        this.name = name;
        this.stepPairs = makePairs(steps);
    }

    private List<StepPair> makePairs(List<Map<String, String>> steps) {
        List<StepPair> pairs = new ArrayList<>();
        for (int i = 0; i < steps.size() - 1; i += 2) {
            pairs.add(new StepPair(steps.get(i), steps.get(i + 1)));
        }
        return pairs;
    }

    public String getName() {
        return name;
    }

    public List<StepPair> getStepPairs() {
        return stepPairs;
    }
}
