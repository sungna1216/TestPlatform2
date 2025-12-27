package com.example.apitest.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class TestFormWrapper {
    private TestForm form;
    private String file;

    // getters and setters
    @JsonProperty("form")
    public TestForm getForm() {
        return form;
    }

    public void setForm(TestForm form) {
        this.form = form;
    }

    @JsonProperty("file")
    public String getFile() {
        return file;
    }

    public void setFile(String file) {
        this.file = file;
    }
}