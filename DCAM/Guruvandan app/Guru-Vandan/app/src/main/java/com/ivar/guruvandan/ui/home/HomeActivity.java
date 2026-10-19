package com.ivar.guruvandan.ui.home;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.NavigationUI;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import com.ivar.guruvandan.R;
import com.ivar.guruvandan.data.utils.Constants;
import com.ivar.guruvandan.databinding.ActivityHomeBinding;
import com.ivar.guruvandan.ui.auth.UserIdActivity;

public class HomeActivity extends AppCompatActivity {

    public static final String EXTRA_USER_NAME = "com.ivar.guru-vandan.ui.home.EXTRA_USER_NAME";

    private ActivityHomeBinding binding;

    private FirebaseAuth mAuth;
    private DatabaseReference sessionRef;
    private ValueEventListener sessionListener;
    private String localDeviceId;

    @SuppressLint("HardwareIds")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        binding = ActivityHomeBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // Standardized Edge-to-Edge UI handling to match your auth screens
        ViewCompat.setOnApplyWindowInsetsListener(binding.main, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int paddingBottom = Math.max(systemBars.bottom, ime.bottom);
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
            return insets;
        });

        binding.bottomNavigation.setOnApplyWindowInsetsListener(null);
        binding.bottomNavigation.setPadding(0,0,0,0);

        mAuth = FirebaseAuth.getInstance();
        localDeviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);

        // 1. Setup the Nav Bar
        setupBottomNavigation();

        // 2. Setup the Realtime Session Listener
        initializeSessionListener();

        // 3. Show Welcome Dialog
        showWelcomeDialogIfNeeded();
    }

    /**
     * Connects the Bottom Navigation directly to your Nav Graph.
     * Fragments will be swapped automatically based on the IDs matching.
     */
    private void setupBottomNavigation() {
        NavHostFragment navHostFragment = (NavHostFragment) getSupportFragmentManager()
                .findFragmentById(R.id.nav_host_fragment);

        if (navHostFragment != null) {
            NavController navController = navHostFragment.getNavController();

            binding.bottomNavigation.setOnItemSelectedListener(item -> {
                int itemId = item.getItemId();

                if (itemId == R.id.nav_meditate) {
                    navController.navigate(itemId, null,
                            new androidx.navigation.NavOptions.Builder()
                                    .setPopUpTo(navController.getGraph().getStartDestinationId(), false)
                                    .setLaunchSingleTop(true)
                                    .build());
                    return true;
                }

                return NavigationUI.onNavDestinationSelected(item, navController);
            });
        }
    }

    /**
     * Listens to the specific user's database node. If the token changes to
     * a different device's hardware ID, it boots them out immediately.
     */
    private void initializeSessionListener() {
        FirebaseUser currentUser = mAuth.getCurrentUser();

        if (currentUser == null) {
            kickToLogin("Session expired. Please log in again.");
            return;
        }

        // Tap into your existing Realtime DB structure
        sessionRef = FirebaseDatabase.getInstance(Constants.DB_REFERENCE).getReference("users")
                .child(currentUser.getUid())
                .child("current_session_token");

        sessionListener = new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                String databaseToken = snapshot.getValue(String.class);

                // If the token exists but doesn't match this phone's hardware ID, they logged in elsewhere.
                if (databaseToken != null && !databaseToken.equals(localDeviceId)) {
                    Log.w("HomeActivity", "Session hijacked by another device. Forcing logout.");

                    // 1. Sign out locally
                    mAuth.signOut();

                    // 2. Route back to start
                    kickToLogin("Logged out: You signed in on another device.");
                }
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                Log.e("HomeActivity", "Session listener cancelled: " + error.getMessage());
            }
        };
    }

    private void kickToLogin(String message) {
        if (message != null && !message.isEmpty()) {
            Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        }

        Intent intent = new Intent(this, UserIdActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    // --- Lifecycle Methods ---

    @Override
    protected void onStart() {
        super.onStart();
        // Attach listener when app comes to foreground
        if (sessionRef != null && sessionListener != null) {
            sessionRef.addValueEventListener(sessionListener);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Detach listener when app goes to background to save battery/data
        if (sessionRef != null && sessionListener != null) {
            sessionRef.removeEventListener(sessionListener);
        }
    }

    @SuppressLint("SetTextI18n")
    private void showWelcomeDialogIfNeeded() {

        SharedPreferences prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE);
        boolean hasSeenWelcome = prefs.getBoolean("has_seen_welcome", false);

        if (hasSeenWelcome) {
            return;
        }

        SharedPreferences.Editor editor = prefs.edit();

        String userName = getIntent().getStringExtra(EXTRA_USER_NAME);

        // Fallback just in case
        if (userName == null || userName.isEmpty()) {
            userName = "भक्त";
        }

        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_welcome);

        // Transparent background for rounded corners
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        TextView welcomeText = dialog.findViewById(R.id.welcome_user_name);
        welcomeText.setText("जय गुरु, " + userName + "!");

        MaterialButton btnEnter = dialog.findViewById(R.id.button_enter);
        btnEnter.setOnClickListener(v -> {
            editor.putBoolean("has_seen_welcome", true);
            editor.apply();
            dialog.dismiss();
        });

        // Prevent closing by clicking outside
        dialog.setCancelable(false);
        dialog.show();
        }


}