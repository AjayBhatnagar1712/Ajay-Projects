package com.ivar.guruvandan.ui.auth;

import android.annotation.SuppressLint;
import android.content.Intent;
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
import com.ivar.guruvandan.data.model.UserModel;
import com.ivar.guruvandan.data.network.NetworkDialogHelper;
import com.ivar.guruvandan.data.network.NetworkMonitor;
import com.ivar.guruvandan.data.utils.Constants;
import com.ivar.guruvandan.databinding.ActivityCreateAccountBinding;

public class CreateAccountActivity extends AppCompatActivity implements NetworkMonitor.NetworkListener {

    private ActivityCreateAccountBinding binding;
    private String userEmail;

    // Network Management
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;
    public static final String EXTRA_EMAIL = "com.ivar.guru-vandan.ui.auth.create-account.EXTRA_EMAIL";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivityCreateAccountBinding.inflate(getLayoutInflater());
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

        // 1. Retrieve the email passed from UserIdActivity
        userEmail = getIntent().getStringExtra(UserIdActivity.EXTRA_EMAIL);

        // 2. Set it to the requesting_email TextView
        if (userEmail != null && !userEmail.isEmpty()) {
            binding.requestingEmail.setText(userEmail);
        }

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

    // --- Network Blocking Logic ---
    @Override
    public void onNetworkStateChanged(NetworkMonitor.NetworkState state) {
        switch (state) {
            case GOOD:
                dialogHelper.hideDialog();
                binding.buttonLogin.setEnabled(true);
                break;
            case UNSTABLE:
            case OFFLINE:
                dialogHelper.showDialog(this);
                binding.buttonLogin.setEnabled(false);
                break;
        }
    }

    // --- Validation & Setup ---
    private void setupClickListeners() {
        binding.buttonLogin.setOnClickListener(v -> {
            String pass = binding.password.getText().toString().trim();
            String confirmPass = binding.confirmPassword.getText().toString().trim();

            // Firebase requires a minimum of 6 characters for passwords
            if (pass.length() < 6) {
                binding.password.setError("Password must be at least 6 characters");
                binding.password.requestFocus();
                return;
            }

            if (!pass.equals(confirmPass)) {
                binding.confirmPassword.setError("Passwords do not match");
                binding.confirmPassword.requestFocus();
                return;
            }

            performRegistration(pass);
        });
    }

    // --- Firebase Auth Logic ---
    @SuppressLint("SetTextI18n")
    private void performRegistration(String password) {
        // Lock UI to prevent double-clicks
        binding.buttonLogin.setEnabled(false);
        binding.buttonLogin.setAlpha(0.3f);
        binding.buttonLogin.setText("Creating your space...");

        FirebaseAuth.getInstance().createUserWithEmailAndPassword(userEmail, password)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        FirebaseUser firebaseUser = task.getResult().getUser();
                        if (firebaseUser != null) {
                            // 1. Send the verification email immediately
                            firebaseUser.sendEmailVerification();

                            // 2. Move to database profile creation
                            buildUserProfile(firebaseUser.getUid());
                        }
                    } else {
                        // Registration Failed (e.g., weak password, or email secretly already exists)
                        binding.buttonLogin.setEnabled(true);
                        binding.buttonLogin.setAlpha(1.0f);
                        binding.buttonLogin.setText("Begin Journey");

                        String errorMsg = task.getException() != null ?
                                task.getException().getLocalizedMessage() : "Registration failed.";
                        Toast.makeText(this, errorMsg, Toast.LENGTH_LONG).show();
                    }
                });
    }

    // --- Database & Routing Logic ---
    @SuppressLint({"SetTextI18n", "HardwareIds"})
    private void buildUserProfile(String uid) {
        binding.buttonLogin.setText("Preparing your journey...");

        // 1. Fetch the unique Hardware ID
        String sessionToken = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);

        // 2. Instantiate the UserModel (uid, email, phone is empty, isEmailVerified is false)
        UserModel newUser = new UserModel(uid, userEmail, "", false);
        newUser.setCurrent_session_token(sessionToken);

        // 3. Save to Realtime Database
        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users")
                .child(uid)
                .setValue(newUser)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        // Success! Route them to the Email Verification Holding Screen
                        Intent intent = new Intent(CreateAccountActivity.this, EmailVerificationActivity.class);
                        // Pass the email forward so the Holding Screen can display it
                        intent.putExtra(EXTRA_EMAIL, userEmail);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                    } else {
                        // Fallback if the database write fails
                        Toast.makeText(this, "Failed to setup profile.", Toast.LENGTH_SHORT).show();
                        binding.buttonLogin.setEnabled(true);
                        binding.buttonLogin.setAlpha(1.0f);
                        binding.buttonLogin.setText("Begin Journey");
                    }
                });
    }

}