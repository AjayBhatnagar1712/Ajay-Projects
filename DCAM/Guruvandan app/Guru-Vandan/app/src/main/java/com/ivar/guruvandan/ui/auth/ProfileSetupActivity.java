package com.ivar.guruvandan.ui.auth;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
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
import com.ivar.guruvandan.databinding.ActivityProfileSetupBinding;
import com.ivar.guruvandan.ui.home.HomeActivity;

import java.util.HashMap;
import java.util.Map;

public class ProfileSetupActivity extends AppCompatActivity implements NetworkMonitor.NetworkListener{

    private ActivityProfileSetupBinding binding;

    // Network Management
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivityProfileSetupBinding.inflate(getLayoutInflater());
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

        setupClickListeners();
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

    // --- Network Blocking Logic (Case 2) ---
    @Override
    public void onNetworkStateChanged(NetworkMonitor.NetworkState state) {
        switch (state) {
            case GOOD:
                dialogHelper.hideDialog();
                binding.continueButton.setEnabled(true);
                break;
            case UNSTABLE:
            case OFFLINE:
                dialogHelper.showDialog(this);
                binding.continueButton.setEnabled(false);
                break;
        }
    }

    // --- Validation Logic (Case 1) ---
    private void setupClickListeners() {
        binding.continueButton.setOnClickListener(v -> {
            String userName = binding.name.getText().toString().trim();

            if (userName.isEmpty()) {
                binding.name.setError("Please share your name with us");
                binding.name.requestFocus();
                return;
            }

            if (userName.length() < 3) {
                binding.name.setError("Name must be at least 3 characters");
                binding.name.requestFocus();
                return;
            }

            saveProfileAndEnter(userName);
        });
    }

    // --- Database Update & Routing Logic (Cases 3, 4, & 5) ---
    @SuppressLint("SetTextI18n")
    private void saveProfileAndEnter(String userName) {
        FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();

        // Case 3: The Phantom User Security Check
        if (currentUser == null) {
            Toast.makeText(this, "Session expired. Please log in again.", Toast.LENGTH_LONG).show();
            // Wipe local prefs just in case
            SharedPreferences prefs = getSharedPreferences("GuruVandanPrefs", MODE_PRIVATE);
            prefs.edit().clear().apply();

            // Route back to start
            Intent intent = new Intent(this, UserIdActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            return;
        }

        // Lock UI to prevent multiple submissions
        binding.continueButton.setEnabled(false);
        binding.continueButton.setAlpha(0.3f);
        binding.continueButton.setText("Preparing your space...");

        String uid = currentUser.getUid();

        // Case 4: The Simultaneous Database Update
        Map<String, Object> profileUpdates = new HashMap<>();
        profileUpdates.put("name", userName);
        profileUpdates.put("isProfileComplete", true);

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users").child(uid)
                .updateChildren(profileUpdates)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        // Case 5: The Golden Path Routing
                        // Ensure you have created your HomeActivity!
                        Intent intent = new Intent(ProfileSetupActivity.this, HomeActivity.class);
                        intent.putExtra(HomeActivity.EXTRA_USER_NAME, userName);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                    } else {
                        // Handle failure (e.g., database rules blocked it)
                        binding.continueButton.setEnabled(true);
                        binding.continueButton.setAlpha(1.0f);
                        binding.continueButton.setText("Enter Guru Vandan");
                        Toast.makeText(this, "Failed to update profile. Please try again.", Toast.LENGTH_SHORT).show();
                    }
                });
    }

}