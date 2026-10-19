package com.ivar.guruvandan.data.model;

import com.google.firebase.database.PropertyName;

public class UserModel {

    private String uid;
    private String name;
    private String email;
    private String phone;
    private boolean isProfileComplete;
    private boolean isEmailVerified;
    private String current_session_token;
    private long createdAt;

    // Required empty constructor for Firebase
    public UserModel() {
    }

    public UserModel(String uid, String email, String phone, boolean isEmailVerified) {
        this.uid = uid;
        this.email = email;
        this.phone = phone;
        this.isEmailVerified = isEmailVerified; // Set during registration
        this.name = "";
        this.isProfileComplete = false;
        this.current_session_token = "";
        this.createdAt = System.currentTimeMillis();
    }

    // Standard Getters and Setters
    public String getUid() { return uid; }
    public void setUid(String uid) { this.uid = uid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getCurrent_session_token() { return current_session_token; }
    public void setCurrent_session_token(String current_session_token) { this.current_session_token = current_session_token; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    // --- THE FIX: Forcing Firebase to keep the "is" prefix ---

    @PropertyName("isProfileComplete")
    public boolean isProfileComplete() { return isProfileComplete; }

    @PropertyName("isProfileComplete")
    public void setProfileComplete(boolean profileComplete) { this.isProfileComplete = profileComplete; }

    @PropertyName("isEmailVerified")
    public boolean isEmailVerified() { return isEmailVerified; }

    @PropertyName("isEmailVerified")
    public void setEmailVerified(boolean emailVerified) { this.isEmailVerified = emailVerified; }
}