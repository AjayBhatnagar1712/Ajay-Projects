package com.ivar.guruvandan.ui.splash;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthInvalidUserException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.ivar.guruvandan.data.network.NetworkDialogHelper;
import com.ivar.guruvandan.data.network.NetworkMonitor;
import com.ivar.guruvandan.data.utils.Constants;
import com.ivar.guruvandan.databinding.ActivitySplashBinding;
import com.ivar.guruvandan.ui.auth.EmailVerificationActivity;
import com.ivar.guruvandan.ui.auth.ProfileSetupActivity;
import com.ivar.guruvandan.ui.auth.UserIdActivity;
import com.ivar.guruvandan.ui.home.HomeActivity;

@SuppressLint("CustomSplashScreen")
public class SplashActivity extends AppCompatActivity implements NetworkMonitor.NetworkListener {

    private ActivitySplashBinding binding;
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;
    private boolean isAuthCheckStarted = false;
    public static final String EXTRA_EMAIL = "com.ivar.guru-vandan.ui.auth.splash.EXTRA_EMAIL";


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivitySplashBinding.inflate(getLayoutInflater());
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

        SharedPreferences prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putBoolean("has_seen_welcome", false);
        editor.apply();

    }

    @Override
    protected void onStart() {
        super.onStart();
        new Handler().postDelayed(()->networkMonitor.startMonitoring(), 500);
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
                dialogHelper.hideDialog();
                if (!isAuthCheckStarted) {
                    isAuthCheckStarted = true;
                    runFirebaseRouting();
                }
                break;

            case UNSTABLE:
            case OFFLINE:
                dialogHelper.showDialog(this); // Overlays the custom UI block
                break;
        }
    }

    private void runFirebaseRouting() {
        FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();
        if (currentUser == null) {
            navigateToAuthScreen();
            return;
        }

        // Ask Google's servers for the freshest account status
        currentUser.reload().addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                // Explicitly check the type of user
                boolean isEmailUser = currentUser.getEmail() != null && !currentUser.getEmail().isEmpty();
                boolean isPhoneUser = currentUser.getPhoneNumber() != null && !currentUser.getPhoneNumber().isEmpty();

                if (isEmailUser) {
                    if (!currentUser.isEmailVerified()) {
                        // Email user who hasn't verified yet. Trap them in Holding Screen.
                        navigateToEmailVerification(currentUser.getEmail());
                    } else {
                        // Verified Email User. Proceed to DB.
                        checkDatabaseProfile(currentUser.getUid(), true);
                    }
                } else if (isPhoneUser) {
                    // Phone Users are inherently verified by SMS. Go straight to DB checks.
                    checkDatabaseProfile(currentUser.getUid(), false);
                } else {
                    // Safety fallback if somehow neither exists
                    performForcedLogout("Invalid account configuration. Please log in again.");
                }

            } else {
                // The reload failed (network timeout or account deleted).
                // Reset the boolean so the network monitor can trigger this again when stable.
                isAuthCheckStarted = false;

                // If the account was deleted by admin while they were away, force them out.
                if (task.getException() instanceof FirebaseAuthInvalidUserException) {
                    performForcedLogout("Account disabled or deleted. Please log in again.");
                } else {
                    Toast.makeText(SplashActivity.this, "Connecting to servers...", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private void checkDatabaseProfile(String uid, boolean isEmailUser) {
        DatabaseReference userRef = FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users").child(uid);

        // Optional but recommended: Force the Database to match Auth status just to be safe
        if (isEmailUser) {
            userRef.child("isEmailVerified").setValue(true);
        }

        userRef.addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                if (snapshot.exists()) {
                    Boolean isProfileComplete = snapshot.child("isProfileComplete").getValue(Boolean.class);
                    String dbToken = snapshot.child("current_session_token").getValue(String.class);
                    String fetchedName = snapshot.child("name").getValue(String.class);
                    String localToken = getLocalSessionToken();

                    // Check A: Single-Device Security
                    if (dbToken != null && !dbToken.equals(localToken)) {
                        performForcedLogout("Session expired. You logged in from another device.");
                        return;
                    }

                    // Check B: Profile Completion
                    if (Boolean.TRUE.equals(isProfileComplete)) {
                        navigateToDashboard(fetchedName);
                    } else {
                        navigateToNameEntry();
                    }

                } else {
                    // Edge Case: App crashed before creating their DB profile
                    navigateToNameEntry();
                }
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                // Database read failed (timeout or permission error).
                // Reset the boolean so the network monitor can try again.
                isAuthCheckStarted = false;
                Toast.makeText(SplashActivity.this, "Network unstable. Retrying...", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @SuppressLint("HardwareIds")
    private String getLocalSessionToken() {
        return android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
    }

    private void performForcedLogout(String message) {
        // Clear Firebase Auth
        FirebaseAuth.getInstance().signOut();

        // Show reason and redirect
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        navigateToAuthScreen();
    }

    private void navigateToEmailVerification(String email) {
        Intent intent = new Intent(this, EmailVerificationActivity.class);
        intent.putExtra(EXTRA_EMAIL, email);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }

    private void navigateToAuthScreen() {
        Intent intent = new Intent(this, UserIdActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }
    private void navigateToNameEntry() {
        Intent intent = new Intent(this, ProfileSetupActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }
    private void navigateToDashboard(String name) {
        Intent intent = new Intent(this, HomeActivity.class);
        intent.putExtra(HomeActivity.EXTRA_USER_NAME, name);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }

}