package com.example.apitest.model;

import java.util.List;

public class TestForm {
    public List<TestScenario> getScenarios() {
        return scenarios;
    }

    public void setScenarios(List<TestScenario> scenarios) {
        this.scenarios = scenarios;
    }

    private List<TestScenario> scenarios;

    // getters, setters
    private String title;
    private String note;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

}