package com.ivar.guruvandan.data.model;

public class SatsangAudio {

    private String category;
    private String title;
    private String description;
    private String duration;
    private int audioResId; // This holds the local file reference (e.g., R.raw.morning_track_1)

    public SatsangAudio(String category, String title, String description, String duration, int audioResId) {
        this.category = category;
        this.title = title;
        this.description = description;
        this.duration = duration;
        this.audioResId = audioResId;
    }

    // Getters so the Adapter can read the data and bind it to your XML UI
    public String getCategory() {
        return category;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getDuration() {
        return duration;
    }

    public int getAudioResId() {
        return audioResId;
    }
}