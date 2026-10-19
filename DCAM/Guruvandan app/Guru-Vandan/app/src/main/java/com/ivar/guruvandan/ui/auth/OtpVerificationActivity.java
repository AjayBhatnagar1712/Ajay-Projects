package com.ivar.guruvandan.ui.auth;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.util.Log;
import android.view.inputmethod.InputMethodManager;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.firebase.FirebaseException;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.PhoneAuthCredential;
import com.google.firebase.auth.PhoneAuthOptions;
import com.google.firebase.auth.PhoneAuthProvider;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import com.ivar.guruvandan.R;
import com.ivar.guruvandan.data.model.UserModel;
import com.ivar.guruvandan.data.network.NetworkDialogHelper;
import com.ivar.guruvandan.data.network.NetworkMonitor;
import com.ivar.guruvandan.data.utils.Constants;
import com.ivar.guruvandan.data.utils.SessionNudgeDialogHelper;
import com.ivar.guruvandan.databinding.ActivityOtpBinding;
import com.ivar.guruvandan.ui.home.HomeActivity;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

/**
 * Handles Phone Authentication via OTP.
 * Features include: SMS Auto-detect, 60-second Resend Timer,
 * Gatekeeper Button Logic, Symmetrical Profile Creation, and Session Management.
 */
public class OtpVerificationActivity extends AppCompatActivity implements NetworkMonitor.NetworkListener {

    private ActivityOtpBinding binding;

    private String phoneNumber;
    private String mVerificationId;
    private PhoneAuthProvider.ForceResendingToken mResendToken;
    private CountDownTimer resendTimer;

    // Gatekeeper to prevent NetworkMonitor from enabling the button too early
    private boolean isOtpSent = false;

    // Infrastructure Helpers
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;
    private SessionNudgeDialogHelper nudgeDialogHelper;
    private FirebaseAuth mAuth;

    @SuppressLint("SetTextI18n")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivityOtpBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        ViewCompat.setOnApplyWindowInsetsListener(binding.main, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int paddingBottom = Math.max(systemBars.bottom, ime.bottom);
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, paddingBottom);
            androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
            return insets;
        });

        mAuth = FirebaseAuth.getInstance();
        nudgeDialogHelper = new SessionNudgeDialogHelper();
        networkMonitor = new NetworkMonitor(this, this);
        dialogHelper = new NetworkDialogHelper();

        // Retrieve the phone number centrally from UserIdActivity
        phoneNumber = getIntent().getStringExtra(UserIdActivity.EXTRA_PHONE);
        if (phoneNumber != null) {
            binding.textDisplayId.setText("We sent a 6-digit code to " + phoneNumber);
        } else {
            Toast.makeText(this, "Error: Phone number missing.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        binding.otpView.requestFocus();
        openSoftKeyboard();

        // Disable the button and dim it until Firebase confirms the SMS is sent
        binding.buttonVerifyOtp.setEnabled(false);
        binding.buttonVerifyOtp.setAlpha(0.3f);

        setupClickListeners();

        // Automatically trigger the SMS when the screen opens
        startPhoneNumberVerification(phoneNumber);
    }

    private void openSoftKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) {
            imm.showSoftInput(binding.otpView, InputMethodManager.SHOW_IMPLICIT);
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

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (resendTimer != null) {
            resendTimer.cancel();
        }
    }

    @Override
    public void onNetworkStateChanged(NetworkMonitor.NetworkState state) {
        switch (state) {
            case GOOD:
                dialogHelper.hideDialog();
                // ONLY enable if the code has actually been dispatched
                if (isOtpSent) {
                    binding.buttonVerifyOtp.setEnabled(true);
                    binding.buttonVerifyOtp.setAlpha(1.0f);
                }
                break;
            case UNSTABLE:
            case OFFLINE:
                dialogHelper.showDialog(this);
                binding.buttonVerifyOtp.setEnabled(false);
                binding.buttonVerifyOtp.setAlpha(0.3f);
                break;
        }
    }

    private void setupClickListeners() {
        binding.buttonVerifyOtp.setOnClickListener(v -> {
            String code = Objects.requireNonNull(binding.otpView.getText()).toString().trim();

            if (code.length() < 6) {
                Toast.makeText(this, "Please enter the full 6-digit code", Toast.LENGTH_SHORT).show();
                return;
            }
            if (mVerificationId == null) {
                Toast.makeText(this, "Please wait for the code to arrive", Toast.LENGTH_SHORT).show();
                return;
            }

            verifyOtpCode(mVerificationId, code);
        });

        binding.buttonResend.setOnClickListener(v -> resendVerificationCode(phoneNumber, mResendToken));

        binding.buttonReturnStart.setOnClickListener(v -> {
            Intent intent = new Intent(OtpVerificationActivity.this, UserIdActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            finish();
        });
    }

    // --- Firebase Phone Auth Logic ---

    private void startPhoneNumberVerification(String phone) {
        PhoneAuthOptions options = PhoneAuthOptions.newBuilder(mAuth)
                .setPhoneNumber(phone)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(this)
                .setCallbacks(mCallbacks)
                .build();
        PhoneAuthProvider.verifyPhoneNumber(options);
    }

    private void resendVerificationCode(String phone, PhoneAuthProvider.ForceResendingToken token) {
        if (token == null) return;

        PhoneAuthOptions options = PhoneAuthOptions.newBuilder(mAuth)
                .setPhoneNumber(phone)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(this)
                .setCallbacks(mCallbacks)
                .setForceResendingToken(token)
                .build();
        PhoneAuthProvider.verifyPhoneNumber(options);
    }

    private final PhoneAuthProvider.OnVerificationStateChangedCallbacks mCallbacks =
            new PhoneAuthProvider.OnVerificationStateChangedCallbacks() {

                @Override
                public void onVerificationCompleted(@NonNull PhoneAuthCredential credential) {
                    // MAGIC AUTO-DETECT: Android read the SMS for us.
                    if (credential.getSmsCode() != null) {
                        binding.otpView.setText(credential.getSmsCode());
                    }
                    signInWithPhoneAuthCredential(credential);
                }

                @Override
                public void onVerificationFailed(@NonNull FirebaseException e) {
                    Log.d("CHECK-VERIFICATION", e.getLocalizedMessage());
                    Toast.makeText(OtpVerificationActivity.this, "Verification Failed: " + e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
                }

                @Override
                public void onCodeSent(@NonNull String verificationId,
                                       @NonNull PhoneAuthProvider.ForceResendingToken token) {
                    mVerificationId = verificationId;
                    mResendToken = token;

                    // The code is sent! Unlock the Continue button.
                    isOtpSent = true;
                    binding.buttonVerifyOtp.setEnabled(true);
                    binding.buttonVerifyOtp.setAlpha(1.0f);

                    startResendTimer();
                }
            };

    private void verifyOtpCode(String verificationId, String code) {
        PhoneAuthCredential credential = PhoneAuthProvider.getCredential(verificationId, code);
        signInWithPhoneAuthCredential(credential);
    }

    @SuppressLint("SetTextI18n")
    private void signInWithPhoneAuthCredential(PhoneAuthCredential credential) {
        binding.buttonVerifyOtp.setEnabled(false);
        binding.buttonVerifyOtp.setAlpha(0.3f);
        binding.buttonVerifyOtp.setText("Verifying...");

        mAuth.signInWithCredential(credential)
                .addOnCompleteListener(this, task -> {
                    if (task.isSuccessful()) {
                        FirebaseUser user = task.getResult().getUser();
                        if (user != null) {
                            String uid = user.getUid();
                            // Grab the phone number from Firebase, fallback to the intent extra if null
                            String authPhone = user.getPhoneNumber() != null ? user.getPhoneNumber() : phoneNumber;

                            // Immediately check the database existence
                            checkDatabaseExistence(uid, authPhone);
                        }
                    } else {
                        binding.buttonVerifyOtp.setEnabled(true);
                        binding.buttonVerifyOtp.setAlpha(1.0f);
                        binding.buttonVerifyOtp.setText("Continue");

                        if (task.getException() instanceof FirebaseAuthInvalidCredentialsException) {
                            binding.otpView.setText("");
                            Toast.makeText(OtpVerificationActivity.this, "Incorrect code. Please try again.", Toast.LENGTH_SHORT).show();
                        } else {
                            Toast.makeText(OtpVerificationActivity.this, "Authentication Failed.", Toast.LENGTH_SHORT).show();
                        }
                    }
                });
    }

    // --- UI Timer Logic ---

    private void startResendTimer() {
        binding.buttonResend.setEnabled(false);

        resendTimer = new CountDownTimer(60000, 1000) {
            @SuppressLint("SetTextI18n")
            @Override
            public void onTick(long millisUntilFinished) {
                binding.buttonResend.setText("Resend in " + millisUntilFinished / 1000 + "s");
            }

            @Override
            public void onFinish() {
                binding.buttonResend.setEnabled(true);
                binding.buttonResend.setText("Resend");
            }
        }.start();
    }

    // --- Database & Session Routing Logic ---

    private void checkDatabaseExistence(String uid, String phone) {
        binding.buttonVerifyOtp.setText("Checking records...");

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users").child(uid)
                .addListenerForSingleValueEvent(new ValueEventListener() {
                    @Override
                    public void onDataChange(@NonNull DataSnapshot snapshot) {
                        if (snapshot.exists()) {
                            // User exists in DB. Move to standard returning-user session checks.
                            checkExistingSessionAndPrompt(uid);
                        } else {
                            // User does NOT exist in DB. Create the empty profile now.
                            createNewBaseProfile(uid, phone);
                        }
                    }

                    @Override
                    public void onCancelled(@NonNull DatabaseError error) {
                        Toast.makeText(OtpVerificationActivity.this, "Database check failed.", Toast.LENGTH_SHORT).show();
                        binding.buttonVerifyOtp.setEnabled(true);
                        binding.buttonVerifyOtp.setAlpha(1.0f);
                        binding.buttonVerifyOtp.setText("Continue");
                    }
                });
    }

    @SuppressLint({"SetTextI18n", "HardwareIds"})
    private void createNewBaseProfile(String uid, String phone) {
        binding.buttonVerifyOtp.setText("Building profile...");

        String sessionToken = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);

        // Mirroring your CreateAccountActivity logic exactly (uid, empty email, phone, false)
        UserModel newUser = new UserModel(uid, "", phone, false);
        newUser.setCurrent_session_token(sessionToken);

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users")
                .child(uid)
                .setValue(newUser)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        // Route straight to ProfileSetupActivity to fill in the empty name
                        Intent intent = new Intent(OtpVerificationActivity.this, ProfileSetupActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                    } else {
                        Toast.makeText(OtpVerificationActivity.this, "Failed to create profile.", Toast.LENGTH_SHORT).show();
                        binding.buttonVerifyOtp.setEnabled(true);
                        binding.buttonVerifyOtp.setAlpha(1.0f);
                        binding.buttonVerifyOtp.setText("Continue");
                    }
                });
    }

    @SuppressLint("SetTextI18n")
    private void checkExistingSessionAndPrompt(String uid) {
        binding.buttonVerifyOtp.setText("Checking active devices...");

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users").child(uid).child("current_session_token")
                .addListenerForSingleValueEvent(new ValueEventListener() {
                    @SuppressLint("HardwareIds")
                    @Override
                    public void onDataChange(@NonNull DataSnapshot snapshot) {
                        String existingToken = snapshot.getValue(String.class);
                        String localDeviceId = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);

                        if (existingToken != null && !existingToken.isEmpty() && !existingToken.equals(localDeviceId)) {
                            showDeviceLogoutNudge(uid);
                        } else {
                            secureSessionAndRoute(uid);
                        }
                    }

                    @Override
                    public void onCancelled(@NonNull DatabaseError error) {
                        Toast.makeText(OtpVerificationActivity.this, "Session check failed.", Toast.LENGTH_SHORT).show();
                        binding.buttonVerifyOtp.setEnabled(true);
                        binding.buttonVerifyOtp.setAlpha(1.0f);
                        binding.buttonVerifyOtp.setText("Continue");
                    }
                });
    }

    private void showDeviceLogoutNudge(String uid) {
        nudgeDialogHelper.showDialog(this, new SessionNudgeDialogHelper.NudgeDialogListener() {
            @Override
            public void onKickOutConfirmed() {
                secureSessionAndRoute(uid);
            }

            @Override
            public void onCancel() {
                FirebaseAuth.getInstance().signOut();
                Intent intent = new Intent(OtpVerificationActivity.this, UserIdActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(intent);
                finish();
            }
        });
    }

    @SuppressLint({"SetTextI18n", "HardwareIds"})
    private void secureSessionAndRoute(String uid) {
        binding.buttonVerifyOtp.setText("Securing session...");

        String newToken = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);

        FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users")
                .child(uid)
                .child("current_session_token")
                .setValue(newToken)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        checkProfileAndRoute(uid);
                    } else {
                        binding.buttonVerifyOtp.setEnabled(true);
                        binding.buttonVerifyOtp.setAlpha(1.0f);
                        binding.buttonVerifyOtp.setText("Continue");
                        Toast.makeText(this, "Failed to secure session.", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    @SuppressLint("SetTextI18n")
    private void checkProfileAndRoute(String uid) {
        binding.buttonVerifyOtp.setText("Preparing your dashboard...");

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
                            intent = new Intent(OtpVerificationActivity.this, HomeActivity.class);
                            intent.putExtra(HomeActivity.EXTRA_USER_NAME, fetchedName);
                        } else {
                            intent = new Intent(OtpVerificationActivity.this, ProfileSetupActivity.class);
                        }

                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                    }

                    @SuppressLint("SetTextI18n")
                    @Override
                    public void onCancelled(@NonNull DatabaseError error) {
                        Toast.makeText(OtpVerificationActivity.this, "Could not load profile.", Toast.LENGTH_SHORT).show();
                        binding.buttonVerifyOtp.setEnabled(true);
                        binding.buttonVerifyOtp.setAlpha(1.0f);
                        binding.buttonVerifyOtp.setText("Continue");
                    }
                });
    }
}