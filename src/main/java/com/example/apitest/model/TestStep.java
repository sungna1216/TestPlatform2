package com.example.apitest.model;

import java.util.List;

public class TestStep {
    private List<String> keys;
    private List<String> values;
    private String caseNo;
    private String priority;
    public String getCaseNo() {
        return caseNo;
    }

    public void setCaseNo(String caseNo) {
        this.caseNo = caseNo;
    }
    public List<String> getKeys() {
        return keys;
    }

    public void setKeys(List<String> keys) {
        this.keys = keys;
    }

    public List<String> getValues() {
        return values;
    }

    public void setValues(List<String> values) {
        this.values = values;
    }

    public List<String> getExpectedKeys() {
        return expectedKeys;
    }

    public void setExpectedKeys(List<String> expectedKeys) {
        this.expectedKeys = expectedKeys;
    }

    public List<String> getExpectedValues() {
        return expectedValues;
    }

    public void setExpectedValues(List<String> expectedValues) {
        this.expectedValues = expectedValues;
    }
    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }
    private List<String> expectedKeys;
    private List<String> expectedValues;

    // getters, setters
}
