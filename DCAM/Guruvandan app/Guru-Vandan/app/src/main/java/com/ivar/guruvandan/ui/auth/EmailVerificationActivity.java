package com.ivar.guruvandan.ui.auth;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.util.Log;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.FirebaseDatabase;
import com.ivar.guruvandan.R;
import com.ivar.guruvandan.data.network.NetworkDialogHelper;
import com.ivar.guruvandan.data.network.NetworkMonitor;
import com.ivar.guruvandan.data.utils.Constants;
import com.ivar.guruvandan.databinding.ActivityEmailVerificationBinding;

public class EmailVerificationActivity extends AppCompatActivity implements NetworkMonitor.NetworkListener {

    private ActivityEmailVerificationBinding binding;

    // Network Management
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;

    // Timer Management
    private CountDownTimer resendTimer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivityEmailVerificationBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        ViewCompat.setOnApplyWindowInsetsListener(binding.main, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int paddingBottom = Math.max(systemBars.bottom, ime.bottom);
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, paddingBottom);
            androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
            return insets;
        });

        // Initialize the network gatekeeper
        networkMonitor = new NetworkMonitor(this, this);
        dialogHelper = new NetworkDialogHelper();

        // 1. Setup the UI with the user's email directly from the Intent
        String incomingEmail = getIntent().getStringExtra("EXTRA_EMAIL");

        if (incomingEmail != null && !incomingEmail.isEmpty()) {
            binding.requestingEmail.setText(incomingEmail);
        } else {
            // Fallback: If for some reason the Intent is empty, ask Firebase
            FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();
            if (currentUser != null && currentUser.getEmail() != null) {
                binding.requestingEmail.setText(currentUser.getEmail());
            }
        }

        setupClickListeners();

        // 2. Lock the button and start the cooldown timer immediately
        // since the first email was just sent from the CreateAccount screen.
        binding.buttonResend.setEnabled(false);
        startCooldownTimer();
    }

    @Override
    protected void onStart() {
        super.onStart();
        networkMonitor.startMonitoring();
    }

    @Override
    protected void onStop() {
        super.onStop();
        networkMonitor.stopMonitoring();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // Prevent memory leaks if the user leaves the screen while the timer is ticking
        if (resendTimer != null) {
            resendTimer.cancel();
        }
    }

    // --- Network Blocking Logic ---
    @Override
    public void onNetworkStateChanged(NetworkMonitor.NetworkState state) {
        switch (state) {
            case GOOD:
                dialogHelper.hideDialog();
                binding.buttonVerified.setEnabled(true);
                break;
            case UNSTABLE:
            case OFFLINE:
                dialogHelper.showDialog(this);
                binding.buttonVerified.setEnabled(false);
                break;
        }
    }

    // --- Button Actions ---
    private void setupClickListeners() {
        // Action 1: Check Verification Status
        binding.buttonVerified.setOnClickListener(v -> verifyUserStatus());

        // Action 2: Resend Email
        binding.buttonResend.setOnClickListener(v -> resendVerificationEmail());

        // Action 3: The Escape Hatch (Return to Start)
        binding.buttonReturnStart.setOnClickListener(v -> abortAndReturnToStart());
    }

    @SuppressLint("SetTextI18n")
    private void verifyUserStatus() {
        FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();
        if (currentUser == null) return;

        // Lock UI to prevent spam clicking
        binding.buttonVerified.setEnabled(false);
        binding.buttonVerified.setAlpha(0.3f);
        binding.buttonVerified.setText("Checking...");

        // Force a sync with Google's servers to get the latest click status
        currentUser.reload().addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                if (currentUser.isEmailVerified()) {
                    // Success! Update Realtime Database and Route
                    updateDatabaseAndProceed(currentUser.getUid());
                } else {
                    // Still not verified
                    restoreVerifyButton();
                    Toast.makeText(this, "We haven't detected verification yet. Please check your inbox or spam folder.", Toast.LENGTH_LONG).show();
                }
            } else {
                // Network or Firebase Error
                restoreVerifyButton();
                Toast.makeText(this, "Could not reach server. Please try again.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @SuppressLint("SetTextI18n")
    private void updateDatabaseAndProceed(String uid) {
        binding.buttonVerified.setText("Path Confirmed...");

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users").child(uid)
                .child("isEmailVerified")
                .setValue(true)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        // Route to Profile Setup smoothly
                        Intent intent = new Intent(EmailVerificationActivity.this, ProfileSetupActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                    } else {
                        // Fallback if the database write fails
                        restoreVerifyButton();
                        Toast.makeText(this, "Failed to update profile. Please try again.", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    @SuppressLint("SetTextI18n")
    private void restoreVerifyButton() {
        binding.buttonVerified.setEnabled(true);
        binding.buttonVerified.setAlpha(1.0f);
        binding.buttonVerified.setText("I Have Verified");
    }

    private void resendVerificationEmail() {
        FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();
        if (currentUser == null) return;

        // Disable button immediately so they can't fire off 5 emails at once
        binding.buttonResend.setEnabled(false);

        currentUser.sendEmailVerification().addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                Toast.makeText(this, "A new invitation has been sent.", Toast.LENGTH_SHORT).show();
                startCooldownTimer();
            } else {
                // If it fails (e.g., rate limit hit), let them try again immediately
                binding.buttonResend.setEnabled(true);
                Toast.makeText(this, "Failed to send email. Please try again.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void startCooldownTimer() {
        // 60,000 milliseconds = 60 seconds. Updates every 1,000ms (1 second).
        resendTimer = new CountDownTimer(60000, 1000) {
            @SuppressLint("SetTextI18n")
            @Override
            public void onTick(long millisUntilFinished) {
                long secondsLeft = millisUntilFinished / 1000;
                binding.buttonResend.setText("Resend Invitation (" + secondsLeft + "s)");
            }

            @SuppressLint("SetTextI18n")
            @Override
            public void onFinish() {
                binding.buttonResend.setEnabled(true);
                binding.buttonResend.setText("Resend Invitation");
            }
        }.start();
    }

    @SuppressLint("SetTextI18n")
    private void abortAndReturnToStart() {
        FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();

        if (currentUser != null) {
            // Lock UI to prevent double-clicks while network requests run
            binding.buttonReturnStart.setEnabled(false);
            binding.buttonReturnStart.setText("Cleaning up...");

            String uid = currentUser.getUid();

            // 1. Delete the junk profile from the Realtime Database
            FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users").child(uid).removeValue()
                    .addOnCompleteListener(dbTask -> {
                        // 2. Delete the user entirely from Firebase Authentication
                        currentUser.delete().addOnCompleteListener(authTask -> {
                            if (authTask.isSuccessful()) {
                                // Success! Complete wipe.
                                Log.d("GURU_VANDAN-password", "Account wipe successful");
                            } else {
                                // FAILURE: Firebase blocked the deletion. Let's see why.
                                String errorMsg = authTask.getException() != null ?
                                        authTask.getException().getLocalizedMessage() : "Account deletion blocked by server.";
                                android.util.Log.e("GuruVandan-Auth", "Auth wipe failed: " + errorMsg);
                                Toast.makeText(this, "Notice: " + errorMsg, Toast.LENGTH_LONG).show();
                            }

                            // 3. Regardless of success or failure, we MUST let them escape the screen.
                            finalizeAbort();
                        });
                    });
        } else {
            finalizeAbort();
        }
    }

    private void finalizeAbort() {
        FirebaseAuth.getInstance().signOut();

        Intent intent = new Intent(EmailVerificationActivity.this, UserIdActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }

}