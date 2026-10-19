package com.ivar.guruvandan.ui.auth;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.util.Patterns;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.SignInMethodQueryResult;
import com.ivar.guruvandan.R;
import com.ivar.guruvandan.data.network.NetworkDialogHelper;
import com.ivar.guruvandan.data.network.NetworkMonitor;
import com.ivar.guruvandan.databinding.ActivityUserIdBinding;

import java.util.Objects;

public class UserIdActivity extends AppCompatActivity implements NetworkMonitor.NetworkListener {

    private ActivityUserIdBinding binding;
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;

    public static final String EXTRA_EMAIL = "com.ivar.guru-vandan.ui.auth-user-id.EXTRA_EMAIL";
    public static final String EXTRA_PHONE = "com.ivar.guru-vandan.ui.auth.EXTRA_PHONE";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivityUserIdBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        ViewCompat.setOnApplyWindowInsetsListener(binding.main, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int paddingBottom = Math.max(systemBars.bottom, ime.bottom);
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, paddingBottom);
            androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
            return insets;
        });

        // Initialize the tools
        networkMonitor = new NetworkMonitor(this, this);
        dialogHelper = new NetworkDialogHelper();
        setupClickListeners();
        setupInputDetection();
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
    public void onNetworkStateChanged(NetworkMonitor.NetworkState state) {
        switch (state) {
            case GOOD:
                dialogHelper.hideDialog(); // Removes the block
                binding.continueButton.setEnabled(true);
                break;

            case UNSTABLE:
            case OFFLINE:
                dialogHelper.showDialog(this); // Overlays the custom UI block
                binding.continueButton.setEnabled(false);
                break;
        }
    }

    private void setupInputDetection() {
        binding.unifiedActorId.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) { }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                String input = s.toString().trim();

                if (!input.isEmpty() && input.trim().length()>5 && !input.startsWith("+")) {
                    if (input.matches("^[0-9+].*")) {
                        binding.countryCode.setVisibility(View.VISIBLE);
                    } else {
                        binding.countryCode.setVisibility(View.GONE);
                    }
                } else {
                    binding.countryCode.setVisibility(View.GONE);
                }
            }

            @Override
            public void afterTextChanged(Editable s) { }
        });
    }

    // --- Authentication Routing Logic ---

    private void setupClickListeners() {
        binding.continueButton.setOnClickListener(v -> {
            String input = binding.unifiedActorId.getText().toString().trim();
            validateAndRoute(input);
        });
    }

    private void validateAndRoute(String input) {
        if (input.isEmpty()) {
            binding.unifiedActorId.setError("Please enter your email or phone number");
            binding.unifiedActorId.requestFocus();
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.showSoftInput(binding.unifiedActorId, InputMethodManager.SHOW_IMPLICIT);
            }
            return;
        }

        if (isEmailValid(input)) {
            proceedWithEmailFlow(input);
        } else if (isPhoneValid(input)) {
            String firebaseReadyPhone = getFirebaseReadyPhone(input);
            proceedWithPhoneFlow(firebaseReadyPhone);
        } else {
            binding.unifiedActorId.setError("Please enter a valid email or phone number");
            binding.unifiedActorId.requestFocus();
        }
    }

    @NonNull
    private String getFirebaseReadyPhone(String input) {

        // 1. Clean the user's typed number (remove spaces, dashes)
        String cleanNumber = input.replaceAll("[\\s\\-()]", "");

        // 2. Fetch the selected code from your new CountryCodePicker
        String selectedCode = binding.countryCode.getSelectedCountryCodeWithPlus();

        // 3. Combine them safely. (If they manually typed the '+', don't add the code twice)
        String firebaseReadyPhone;
        if (cleanNumber.startsWith("+")) {
            firebaseReadyPhone = cleanNumber;
        } else {
            firebaseReadyPhone = selectedCode + cleanNumber;
        }
        return firebaseReadyPhone;
    }

    // Uses Android's built-in Regex for Email
    private boolean isEmailValid(String email) {
        return Patterns.EMAIL_ADDRESS.matcher(email).matches();
    }

    // Uses Android's built-in Regex for Phone, plus a length check to ensure it's a real number
    private boolean isPhoneValid(String phone) {
        String digitsOnly = phone.replaceAll("\\D", "");
        return Patterns.PHONE.matcher(phone).matches() && digitsOnly.length() >= 10;
    }

    @SuppressLint("SetTextI18n")
    private void proceedWithPhoneFlow(String formattedPhone) {
        // 1. Prevent double-clicks to ensure we don't open the next screen twice
        binding.continueButton.setEnabled(false);
        binding.continueButton.setAlpha(0.3f);
        binding.continueButton.setText("Loading...");

        // 2. Route directly to the OTP screen.
        // We will check if they are a new/returning user AFTER they verify the OTP.
        Intent intent = new Intent(UserIdActivity.this, OtpVerificationActivity.class);
        intent.putExtra(EXTRA_PHONE, formattedPhone);
        startActivity(intent);

        // 3. Restore the button state immediately in case the user presses the 'Back'
        // button on the OTP screen and returns to this Activity.
        binding.continueButton.setEnabled(true);
        binding.continueButton.setAlpha(1.0f);
        binding.continueButton.setText("Continue");
    }

    @SuppressLint("SetTextI18n")
    private void proceedWithEmailFlow(String rawEmail) {
        // 1. Prevent double-clicks while we wait for Firebase
        String email = normalizeEmail(rawEmail);
        binding.continueButton.setEnabled(false);
        binding.continueButton.setAlpha(0.3f);
        binding.continueButton.setText("Checking..."); // Optional: Updates button text to show activity

        // 2. Query Firebase Auth to see if this email has any sign-in methods attached
        FirebaseAuth.getInstance().fetchSignInMethodsForEmail(email)
                .addOnCompleteListener(task -> {

                    // 3. Restore the button immediately when Firebase responds
                    binding.continueButton.setEnabled(true);
                    binding.continueButton.setAlpha(1.0f);
                    binding.continueButton.setText("Continue");

                    if (task.isSuccessful()) {
                        // If the list of methods is empty, this is a brand new user.
                        Intent intent = getIntentForEmail(email, task);
                        startActivity(intent);
                    } else {
                        // Edge Case: Firebase failed (e.g., network drop during the call)
                        String errorMsg = task.getException() != null ? task.getException().getLocalizedMessage() : "Verification failed. Please try again.";
                        Toast.makeText(UserIdActivity.this, errorMsg, Toast.LENGTH_SHORT).show();
                    }
                });
    }

    @NonNull
    private Intent getIntentForEmail(String email, Task<SignInMethodQueryResult> task) {
        boolean isNewUser = Objects.requireNonNull(task.getResult().getSignInMethods()).isEmpty();

        Intent intent;
        if (isNewUser) {
            // NEW USER: Route to the Create Password Screen
            intent = new Intent(UserIdActivity.this, CreateAccountActivity.class);
        } else {
            // RETURNING USER: Route to the Password Login Screen
            intent = new Intent(UserIdActivity.this, PasswordActivity.class);
        }
        intent.putExtra(EXTRA_EMAIL, email);
        return intent;
    }

    /**
     * Cleans the email by removing any "+alias" tags before the @ symbol.
     * Example: "user+guru.vandan@gmail.com" becomes "user@gmail.com"
     */
    private String normalizeEmail(String rawEmail) {
        if (rawEmail == null || rawEmail.isEmpty()) {
            return "";
        }

        String email = rawEmail.toLowerCase().trim();

        int plusIndex = email.indexOf('+');
        int atIndex = email.indexOf('@');

        // If there is a '+' and it comes BEFORE the '@' symbol
        if (plusIndex != -1 && atIndex != -1 && plusIndex < atIndex) {
            String baseName = email.substring(0, plusIndex);
            String domain = email.substring(atIndex);
            return baseName + domain;
        }

        return email;
    }

}