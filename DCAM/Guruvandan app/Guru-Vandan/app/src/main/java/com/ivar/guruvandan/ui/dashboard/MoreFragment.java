package com.ivar.guruvandan.ui.dashboard;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.ivar.guruvandan.R;
import com.ivar.guruvandan.data.network.NetworkDialogHelper;
import com.ivar.guruvandan.data.network.NetworkMonitor;
import com.ivar.guruvandan.ui.auth.UserIdActivity;

public class MoreFragment extends Fragment implements NetworkMonitor.NetworkListener {

    private MaterialButton buttonLogout;
    private NetworkMonitor networkMonitor;
    private NetworkDialogHelper dialogHelper;
    private boolean isNetworkGood = false;

    public MoreFragment() {
        // Required empty public constructor
    }

    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_more, container, false);

        buttonLogout = view.findViewById(R.id.button_logout);

        // Initialize your custom Network Tools
        networkMonitor = new NetworkMonitor(requireContext(), this);
        dialogHelper = new NetworkDialogHelper();

        buttonLogout.setOnClickListener(v -> {
            if (isNetworkGood) {
                performLogout();
            } else {
                Toast.makeText(requireContext(), "No stable internet connection. Cannot logout.", Toast.LENGTH_SHORT).show();
            }
        });

        return view;
    }

    @Override
    public void onStart() {
        super.onStart();
        // Start monitoring network with a slight delay following your Splash pattern
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (networkMonitor != null) {
                networkMonitor.startMonitoring();
            }
        }, 500);
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
        // Prevent crashes if the user navigated away while the callback was firing
        if (getActivity() == null || !isAdded()) return;

        switch (state) {
            case GOOD:
                dialogHelper.hideDialog();
                isNetworkGood = true;
                break;

            case UNSTABLE:
            case OFFLINE:
                dialogHelper.showDialog(requireActivity()); // Overlays your custom No Internet UI
                isNetworkGood = false;
                break;
        }
    }

    private void performLogout() {
        // 1. Sign out of Firebase
        FirebaseAuth.getInstance().signOut();

        // 2. Navigate to Login and clear the backstack
        Intent intent = new Intent(requireContext(), UserIdActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);

        // 3. Kill the HomeActivity so they can't return
        if (getActivity() != null) {
            getActivity().finish();
        }
    }
}