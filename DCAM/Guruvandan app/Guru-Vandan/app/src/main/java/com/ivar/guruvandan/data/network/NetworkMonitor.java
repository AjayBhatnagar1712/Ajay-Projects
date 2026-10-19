package com.ivar.guruvandan.data.network;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

public class NetworkMonitor {

    private final ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private final NetworkListener listener;

    // We store the current state so we don't spam the UI with duplicate updates
    private NetworkState currentState = null;

    // 1. The 3 States
    public enum NetworkState {
        GOOD,
        UNSTABLE,
        OFFLINE
    }

    // 2. The Updated Interface
    public interface NetworkListener {
        void onNetworkStateChanged(NetworkState state);
    }

    public NetworkMonitor(Context context, NetworkListener listener) {
        this.connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        this.listener = listener;
    }

    public void startMonitoring() {
        if (connectivityManager == null) return;

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                // We do nothing here! We wait for onCapabilitiesChanged to give us the exact speed and status.
            }

            @Override
            public void onLost(@NonNull Network network) {
                updateState(NetworkState.OFFLINE);
            }

            @Override
            public void onCapabilitiesChanged(@NonNull Network network, @NonNull NetworkCapabilities capabilities) {
                boolean hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                boolean isValidated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);

                // Get the current download speed in Kbps
                int downSpeedKbps = capabilities.getLinkDownstreamBandwidthKbps();

                if (hasInternet && isValidated) {
                    // It has internet. Now we check if it is too slow to function properly.
                    // 1000 Kbps = 1 Mbps. If it's slower than this, we mark it unstable.
                    if (downSpeedKbps > 0 && downSpeedKbps < 1000) {
                        updateState(NetworkState.UNSTABLE);
                    } else {
                        updateState(NetworkState.GOOD);
                    }
                } else if (hasInternet) {
                    // Connected to a router/tower, but the internet is trapped (e.g. cafe login screen or dead provider)
                    updateState(NetworkState.UNSTABLE);
                } else {
                    updateState(NetworkState.OFFLINE);
                }
            }
        };

        NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();

        connectivityManager.registerNetworkCallback(request, networkCallback);
        checkInitialState();
    }

    public void stopMonitoring() {
        if (connectivityManager != null && networkCallback != null) {
            connectivityManager.unregisterNetworkCallback(networkCallback);
        }
    }

    // 3. Helper to safely push updates to your Activity
    private void updateState(NetworkState newState) {
        if (currentState != newState) {
            currentState = newState;
            new Handler(Looper.getMainLooper()).post(() -> listener.onNetworkStateChanged(newState));
        }
    }

    // 4. Initial check when the screen opens
    private void checkInitialState() {
        Network activeNetwork = connectivityManager.getActiveNetwork();
        if (activeNetwork == null) {
            updateState(NetworkState.OFFLINE);
            return;
        }

        NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(activeNetwork);
        if (capabilities == null) {
            updateState(NetworkState.OFFLINE);
            return;
        }

        // Run the same logic as onCapabilitiesChanged to set the starting state
        boolean isValidated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        int downSpeedKbps = capabilities.getLinkDownstreamBandwidthKbps();

        if (isValidated) {
            if (downSpeedKbps > 0 && downSpeedKbps < 1000) {
                updateState(NetworkState.UNSTABLE);
            } else {
                updateState(NetworkState.GOOD);
            }
        } else {
            updateState(NetworkState.UNSTABLE);
        }
    }
}