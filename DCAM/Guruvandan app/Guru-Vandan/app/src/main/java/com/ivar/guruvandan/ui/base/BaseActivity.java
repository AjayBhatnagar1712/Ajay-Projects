package com.ivar.guruvandan.ui.base;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
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
import com.ivar.guruvandan.databinding.ActivityBaseBinding;
import com.ivar.guruvandan.databinding.ActivityHomeBinding;
import com.ivar.guruvandan.ui.auth.UserIdActivity;

public class BaseActivity extends AppCompatActivity implements NetworkMonitor.NetworkListener {

    private ActivityBaseBinding binding;

    // Network Management
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivityBaseBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        ViewCompat.setOnApplyWindowInsetsListener(binding.main, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int paddingBottom = Math.max(systemBars.bottom, ime.bottom);
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, paddingBottom);
            androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
            return insets;
        });

        String manufacturer = Build.MANUFACTURER; // e.g., "samsung" or "Google"
        String model = Build.MODEL;

        // Initialize the network gatekeeper
        networkMonitor = new NetworkMonitor(this, this);
        dialogHelper = new NetworkDialogHelper();

        setupClickListeners();

        Log.d("GuruVandan-Auth", getDeviceModelName());
        Toast.makeText(this, getDeviceModelName(), Toast.LENGTH_LONG).show();

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

    // --- Network Blocking Logic ---
    @Override
    public void onNetworkStateChanged(NetworkMonitor.NetworkState state) {
        switch (state) {
            case GOOD:
                dialogHelper.hideDialog();
                binding.buttonLogout.setEnabled(true);
                break;
            case UNSTABLE:
            case OFFLINE:
                dialogHelper.showDialog(this);
                binding.buttonLogout.setEnabled(false);
                break;
        }
    }

    private void setupClickListeners() {
        binding.buttonLogout.setOnClickListener(v -> performLogout());
    }

    private void performLogout() {
        FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();

        // 1. Lock the UI to prevent spam clicks
        binding.buttonLogout.setEnabled(false);
        binding.buttonLogout.setAlpha(0.3f);
        binding.buttonLogout.setText("Logging out...");

        if (currentUser != null) {
            // 2. Wipe the session token from the Realtime Database
            // NOTE: Ensure your FirebaseDatabase URL matches your Singapore region URL here!
            FirebaseDatabase.getInstance(Constants.DB_REFERENCE)
                    .getReference("users")
                    .child(currentUser.getUid())
                    .child("current_session_token")
                    .setValue("")
                    .addOnCompleteListener(task -> {
                        // 3. Regardless of database success/fail, sign them out of Auth and route
                        finalizeLogout();
                    });
        } else {
            finalizeLogout();
        }
    }

    private void finalizeLogout() {
        // Sign out of Google's Firebase Auth
        FirebaseAuth.getInstance().signOut();

        // Route back to the very beginning and destroy the activity stack
        Intent intent = new Intent(BaseActivity.this, UserIdActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }

    public String getDeviceModelName() {
        String manufacturer = Build.MANUFACTURER;
        String model = Build.MODEL;

        if (model.toLowerCase().startsWith(manufacturer.toLowerCase())) {
            return capitalize(model);
        } else {
            return capitalize(manufacturer) + " " + model;
        }
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return "";
        char first = s.charAt(0);
        if (Character.isUpperCase(first)) {
            return s;
        } else {
            return Character.toUpperCase(first) + s.substring(1);
        }
    }

}