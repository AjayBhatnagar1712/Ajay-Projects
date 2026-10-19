package com.ivar.guruvandan.ui.dashboard;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;

import com.ivar.guruvandan.R;
import com.ivar.guruvandan.data.network.NetworkMonitor;
import com.ivar.guruvandan.databinding.FragmentHomeBinding;
import com.ivar.guruvandan.ui.home.HomeActivity;

public class HomeFragment extends Fragment implements NetworkMonitor.NetworkListener {

    private FragmentHomeBinding binding;
    private NetworkMonitor networkMonitor;

    // --- STATE VARIABLES ---
    private boolean hasFetchedData = false;

    private int currentStreak = 0;
    private int bestStreak = 0;
    private int totalDays = 0;

    private boolean isMorningSatsangDone = false;
    private boolean isEveningSatsangDone = false;
    private boolean isMeditationDone = false;

    private int daysToNextMilestone = 7;

    public HomeFragment() {
        // Required empty public constructor
    }

    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        binding = FragmentHomeBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        // Initialize our network monitor specifically for this fragment
        networkMonitor = new NetworkMonitor(requireContext(), this);

        setupDynamicGreeting();
        setupShareFunctionality();

        // Render whatever the default state is right now
        updateStreakUI();
    }

    // ==========================================
    // NETWORK & DATA LOGIC
    // ==========================================

    @Override
    public void onStart() {
        super.onStart();
        // Delaying monitor slightly to avoid instant false-offline triggers during fragment transitions
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (networkMonitor != null) networkMonitor.startMonitoring();
        }, 300);
    }

    @Override
    public void onStop() {
        super.onStop();
        if (networkMonitor != null) {
            networkMonitor.stopMonitoring();
        }
    }

    @Override
    public void onNetworkStateChanged(NetworkMonitor.NetworkState state) {
        switch (state) {
            case GOOD:
                // We have internet! Let's fetch data ONLY if we haven't already.
                if (!hasFetchedData) {
                    fetchStreakDataFromFirebase();
                }
                break;

            case UNSTABLE:
            case OFFLINE:
                // We are offline! If we have never fetched data, ensure the UI is clean (Zeros).
                if (!hasFetchedData) {
                    resetStreakToZero();
                }
                // (Notice how we do nothing if hasFetchedData is true.
                // They just keep seeing the data we already fetched!)
                break;
        }
    }

    /**
     * DUMMY FIREBASE CALL
     * Simulates fetching data from the database.
     */
    private void fetchStreakDataFromFirebase() {
        // TODO: Replace this block with actual Firebase ValueEventListener logic later.

        // Simulating some fake data for your UI
        currentStreak = 12;
        bestStreak = 45;
        totalDays = 120;
        isMorningSatsangDone = true;
        isEveningSatsangDone = false;
        isMeditationDone = true;
        daysToNextMilestone = 3;

        // CRITICAL: Flip the memory switch so we don't burn database reads if network drops and reconnects
        hasFetchedData = true;

        // Push variables to the UI
        updateStreakUI();
    }

    /**
     * Safe fallback for users who open the app completely offline
     * with no cached memory.
     */
    private void resetStreakToZero() {
        currentStreak = 0;
        bestStreak = 0;
        totalDays = 0;
        isMorningSatsangDone = false;
        isEveningSatsangDone = false;
        isMeditationDone = false;
        daysToNextMilestone = 7;

        updateStreakUI();
    }

    /**
     * Applies the current local variables to the UI elements.
     */
    @SuppressLint("SetTextI18n")
    private void updateStreakUI() {
        if (binding == null) return; // Prevent crashes if fragment is detaching

        // Text Stats
        binding.textStreakCurrent.setText(String.valueOf(currentStreak));
        binding.textStreakBest.setText(String.valueOf(bestStreak));
        binding.textStreakTotal.setText(String.valueOf(totalDays));
        binding.textNextMilestoneDays.setText(String.format("%s days", daysToNextMilestone));

        // Colors for indicators
        int maroonColor = ContextCompat.getColor(requireContext(), R.color.primary_maroon);
        int mutedColor = ContextCompat.getColor(requireContext(), R.color.text_muted);

        // Daily Tracker Circles
        binding.morningSatsangIndicator.setCardBackgroundColor(isMorningSatsangDone ? maroonColor : mutedColor);
        binding.eveningSatsangIndicator.setCardBackgroundColor(isEveningSatsangDone ? maroonColor : mutedColor);
        binding.meditateIndicator.setCardBackgroundColor(isMeditationDone ? maroonColor : mutedColor);
    }

    // ==========================================
    // UI SETUP LOGIC
    // ==========================================

    @SuppressLint("SetTextI18n")
    private void setupDynamicGreeting() {
        String userName = null;
        if (getActivity() != null && getActivity().getIntent() != null) {
            userName = getActivity().getIntent().getStringExtra(HomeActivity.EXTRA_USER_NAME);
        }

        if (userName == null || userName.isEmpty()) {
            userName = "भक्त";
        }

        binding.textGreetingBanner.setText("जय गुरु, " + userName + " — Jai Guru");
    }

    private void setupShareFunctionality() {
        binding.buttonShareApp.setOnClickListener(v -> {
            String shareMessage = "Experience daily satsang, meditation, and Sadguru's wisdom on Guru Vandan. " +
                    "Join the spiritual journey here:\n\n" +
                    "https://play.google.com/store/apps/details?id=" + requireActivity().getPackageName();

            Intent sendIntent = new Intent();
            sendIntent.setAction(Intent.ACTION_SEND);
            sendIntent.putExtra(Intent.EXTRA_TEXT, shareMessage);
            sendIntent.setType("text/plain");

            Intent shareIntent = Intent.createChooser(sendIntent, "Share Guru Vandan via");
            startActivity(shareIntent);
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}