package com.ivar.guruvandan.ui.auth;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.Window;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.ivar.guruvandan.R;
import com.ivar.guruvandan.data.network.NetworkDialogHelper;
import com.ivar.guruvandan.data.network.NetworkMonitor;
import com.ivar.guruvandan.data.utils.Constants;
import com.ivar.guruvandan.data.utils.SessionNudgeDialogHelper;
import com.ivar.guruvandan.databinding.ActivityPasswordBinding;
import com.ivar.guruvandan.ui.home.HomeActivity;

import java.util.Objects;

/**
 * Handles existing user authentication via Email/Password.
 * Features include: Account Recovery (Custom Dialog), Unverified Account Blocking,
 * and Multi-Device Session Management.
 */
public class PasswordActivity extends AppCompatActivity implements NetworkMonitor.NetworkListener {

    private ActivityPasswordBinding binding;
    private String userEmail;

    // Infrastructure Helpers
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;
    private SessionNudgeDialogHelper nudgeDialogHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivityPasswordBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // Handle edge-to-edge UI insets to prevent UI overlap with system bars
        ViewCompat.setOnApplyWindowInsetsListener(binding.main, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int paddingBottom = Math.max(systemBars.bottom, ime.bottom);
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, paddingBottom);
            androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
            return insets;
        });

        // Initialize helper tools
        nudgeDialogHelper = new SessionNudgeDialogHelper();
        networkMonitor = new NetworkMonitor(this, this);
        dialogHelper = new NetworkDialogHelper();

        // Retrieve and display the email securely passed from UserIdActivity
        userEmail = getIntent().getStringExtra(UserIdActivity.EXTRA_EMAIL);
        if (userEmail != null) {
            binding.requestingEmail.setText(userEmail);
        }

        // Automatically focus the password field and show the keyboard for a smoother UX
        binding.password.requestFocus();
        openSoftKeyboard();

        setupClickListeners();
    }

    private void openSoftKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) {
            imm.showSoftInput(binding.password, InputMethodManager.SHOW_IMPLICIT);
        }
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

    /**
     * Prevents the user from attempting to log in if the network drops,
     * showing a blocking dialog until the connection stabilizes.
     */
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

    private void setupClickListeners() {
        binding.buttonLogin.setOnClickListener(v -> {
            String password = binding.password.getText().toString().trim();

            if (password.isEmpty()) {
                binding.password.setError("Please enter your password");
                binding.password.requestFocus();
                openSoftKeyboard();
                return;
            }

            performLogin(password);
        });

        // Trigger the custom account recovery flow when requested
        binding.forgotPassword.setOnClickListener(v -> showAccountRecoveryDialog());
    }

    /**
     * Inflates and displays a custom-themed dialog for Account Recovery.
     * This acts as a transparent way for legitimate users to claim hijacked emails
     * or simply reset a forgotten password.
     */
    private void showAccountRecoveryDialog() {
        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_account_recovery);

        // Remove default white background to allow CardView corner radius to display properly
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        Button btnCancel = dialog.findViewById(R.id.button_cancel);
        Button btnSend = dialog.findViewById(R.id.button_send_link);

        btnCancel.setOnClickListener(v -> dialog.dismiss());

        btnSend.setOnClickListener(v -> {
            sendRecoveryEmail();
            dialog.dismiss();
        });

        dialog.show();
    }

    /**
     * Triggers the secure Firebase Password Reset email.
     */
    private void sendRecoveryEmail() {
        if (userEmail == null || userEmail.isEmpty()) return;

        FirebaseAuth.getInstance().sendPasswordResetEmail(userEmail)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        Toast.makeText(PasswordActivity.this, "Recovery email sent! See you shortly.", Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(PasswordActivity.this, "Failed to send link. Please try again.", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    /**
     * Core authentication method. Validates credentials and implements "The Bouncer" check
     * to ensure unverified accounts cannot access the app.
     */
    @SuppressLint("SetTextI18n")
    private void performLogin(String password) {
        // Lock UI to prevent rapid double-clicks during network requests
        binding.buttonLogin.setEnabled(false);
        binding.buttonLogin.setAlpha(0.3f);
        binding.buttonLogin.setText("Authenticating...");

        FirebaseAuth.getInstance().signInWithEmailAndPassword(userEmail, password)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        FirebaseUser user = task.getResult().getUser();

                        // THE BOUNCER: If the user successfully authenticates but hasn't verified their email,
                        // halt the process and route them strictly to the verification screen.
                        if (user != null && !user.isEmailVerified()) {
                            Intent intent = new Intent(PasswordActivity.this, EmailVerificationActivity.class);
                            intent.putExtra(UserIdActivity.EXTRA_EMAIL, userEmail);
                            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                            startActivity(intent);
                            return;
                        }

                        // User is verified. Proceed to multi-device hardware checks.
                        String uid = Objects.requireNonNull(user).getUid();
                        checkExistingSessionAndPrompt(uid);

                    } else {
                        // Authentication failed (wrong password, network error, etc.)
                        binding.buttonLogin.setEnabled(true);
                        binding.buttonLogin.setAlpha(1.0f);
                        binding.buttonLogin.setText("Resume Journey");

                        String errorMsg = task.getException() != null ?
                                task.getException().getLocalizedMessage() : "Login failed. Please try again.";
                        Toast.makeText(PasswordActivity.this, errorMsg, Toast.LENGTH_SHORT).show();
                    }
                });
    }

    /**
     * Queries the Realtime Database to check if another device is currently holding
     * the active session token for this account.
     */
    @SuppressLint("SetTextI18n")
    private void checkExistingSessionAndPrompt(String uid) {
        binding.buttonLogin.setText("Checking active devices...");

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users").child(uid).child("current_session_token")
                .addListenerForSingleValueEvent(new ValueEventListener() {
                    @SuppressLint("HardwareIds")
                    @Override
                    public void onDataChange(@NonNull DataSnapshot snapshot) {
                        String existingToken = snapshot.getValue(String.class);
                        String localDeviceId = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);

                        // If the DB token doesn't match this phone's hardware ID, they are logged in elsewhere
                        if (existingToken != null && !existingToken.isEmpty() && !existingToken.equals(localDeviceId)) {
                            showDeviceLogoutNudge(uid);
                        } else {
                            // Safe to proceed: No active session, or it's already on this device
                            secureSessionAndRoute(uid);
                        }
                    }

                    @Override
                    public void onCancelled(@NonNull DatabaseError error) {
                        Toast.makeText(PasswordActivity.this, "Session check failed.", Toast.LENGTH_SHORT).show();
                        binding.buttonLogin.setEnabled(true);
                        binding.buttonLogin.setAlpha(1.0f);
                        binding.buttonLogin.setText("Resume Journey");
                    }
                });
    }

    /**
     * Prompts the user to decide if they want to overwrite the session on the other device.
     */
    @SuppressLint("SetTextI18n")
    private void showDeviceLogoutNudge(String uid) {
        nudgeDialogHelper.showDialog(this, new SessionNudgeDialogHelper.NudgeDialogListener() {
            @Override
            public void onKickOutConfirmed() {
                // User agreed to hijack the session. Overwrite the DB token.
                secureSessionAndRoute(uid);
            }

            @Override
            public void onCancel() {
                // User backed out. Undo the Firebase authentication quietly.
                FirebaseAuth.getInstance().signOut();

                Intent intent = new Intent(PasswordActivity.this, UserIdActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
                finish();
            }
        });
    }

    /**
     * Writes this device's unique Hardware ID into the Database as the active session token,
     * effectively locking out any previous devices.
     */
    @SuppressLint({"SetTextI18n", "HardwareIds"})
    private void secureSessionAndRoute(String uid) {
        binding.buttonLogin.setText("Securing session...");

        String newToken = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users")
                .child(uid)
                .child("current_session_token")
                .setValue(newToken)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        checkProfileAndRoute(uid);
                    } else {
                        binding.buttonLogin.setEnabled(true);
                        binding.buttonLogin.setAlpha(1.0f);
                        binding.buttonLogin.setText("Resume Journey");
                        Toast.makeText(this, "Failed to secure session.", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    /**
     * Final routing check. Determines if the user needs to complete profile onboarding
     * or if they can be sent straight to the main dashboard.
     */
    @SuppressLint("SetTextI18n")
    private void checkProfileAndRoute(String uid) {
        binding.buttonLogin.setText("Preparing your dashboard...");

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users").child(uid)
                .addListenerForSingleValueEvent(new ValueEventListener() {
                    @Override
                    public void onDataChange(@NonNull DataSnapshot snapshot) {
                        boolean isProfileComplete = false;
                        String fetchedName = "";

                        if (snapshot.hasChild("isProfileComplete")) {
                            Boolean dbValue = snapshot.child("isProfileComplete").getValue(Boolean.class);
                            if (dbValue != null) {
                                isProfileComplete = dbValue;
                            }
                        }

                        if (snapshot.hasChild("name")) {
                            fetchedName = snapshot.child("name").getValue(String.class);
                        }

                        Intent intent;
                        if (isProfileComplete) {
                            intent = new Intent(PasswordActivity.this, HomeActivity.class);
                            intent.putExtra(HomeActivity.EXTRA_USER_NAME, fetchedName);
                        } else {
                            intent = new Intent(PasswordActivity.this, ProfileSetupActivity.class);
                        }

                        // Clear the backstack so they cannot press 'Back' to return to the login screen
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                    }

                    @SuppressLint("SetTextI18n")
                    @Override
                    public void onCancelled(@NonNull DatabaseError error) {
                        Toast.makeText(PasswordActivity.this, "Could not load profile. Please try again.", Toast.LENGTH_SHORT).show();
                        binding.buttonLogin.setEnabled(true);
                        binding.buttonLogin.setAlpha(1.0f);
                        binding.buttonLogin.setText("Resume Journey");
                    }
                });
    }
}