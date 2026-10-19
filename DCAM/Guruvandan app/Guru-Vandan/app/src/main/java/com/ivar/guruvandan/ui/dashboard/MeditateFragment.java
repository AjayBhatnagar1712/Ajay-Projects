package com.ivar.guruvandan.ui.dashboard;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.widget.SwitchCompat;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.progressindicator.CircularProgressIndicator;
import com.ivar.guruvandan.R;
import com.ivar.guruvandan.ui.home.HomeActivity;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MeditateFragment extends Fragment {

    private TextView textUserGreeting, textTimerRemaining;
    private EditText editCustomDuration;
    private SwitchCompat switchOmChanting;
    private CircularProgressIndicator progressTimer;
    private MaterialButton btnReady;
    private LinearLayout layoutActiveControls, layoutCompletedState;
    private MaterialCardView buttonReload, buttonPlayPause, buttonFinishMeditation;
    private ImageView buttonPlayPauseIcon;

    private final List<MaterialCardView> durationChips = new ArrayList<>();
    private final int[] chipIds = {R.id.duration_5min, R.id.duration_10min, R.id.duration_15min, R.id.duration_20min, R.id.duration_25min, R.id.duration_30min};
    private final int[] chipMinutes = {5, 10, 15, 20, 25, 30};

    private long totalTimeInMillis = 600000;
    private long timeRemainingInMillis = 600000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable updateRunnable;
    private boolean isTimerRunning = false;
    private boolean isTextWatcherActive = true;
    private ExoPlayer exoPlayer;

    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_meditate, container, false);

        textUserGreeting = view.findViewById(R.id.text_user_greeting);
        editCustomDuration = view.findViewById(R.id.edit_custom_duration);
        switchOmChanting = view.findViewById(R.id.switch_om_chanting);
        progressTimer = view.findViewById(R.id.progress_timer);
        textTimerRemaining = view.findViewById(R.id.text_timer_remaining);
        btnReady = view.findViewById(R.id.btn_ready);
        layoutActiveControls = view.findViewById(R.id.layout_active_controls);
        layoutCompletedState = view.findViewById(R.id.layout_completed_state);
        buttonReload = view.findViewById(R.id.button_reload);
        buttonPlayPause = view.findViewById(R.id.button_play_pause);
        buttonPlayPauseIcon = view.findViewById(R.id.button_play_pause_icon);
        buttonFinishMeditation = view.findViewById(R.id.button_finish_meditation);

        totalTimeInMillis = 600000;
        timeRemainingInMillis = 600000;
        isTimerRunning = false;

        setupGreeting();
        setupDurationChips(view);
        setupCustomDurationInput();
        setupExoPlayer();
        setupControlListeners();

        progressTimer.setMax((int) totalTimeInMillis);
        progressTimer.setProgress((int) totalTimeInMillis);
        updateTimerText(totalTimeInMillis);

        return view;
    }

    private void setupGreeting() {
        String name = "भक्त";
        if (getActivity() != null && getActivity().getIntent() != null) {
            String n = getActivity().getIntent().getStringExtra(HomeActivity.EXTRA_USER_NAME);
            if (n != null && !n.isEmpty()) name = n;
        }
        textUserGreeting.setText("Jai Guru, " + name);
    }

    private void setupDurationChips(View rootView) {
        for (int i = 0; i < chipIds.length; i++) {
            final int index = i;
            MaterialCardView chip = rootView.findViewById(chipIds[i]);
            durationChips.add(chip);
            chip.setOnClickListener(v -> {
                updateChipSelectionUI(chip);
                totalTimeInMillis = (long) chipMinutes[index] * 60000;
                timeRemainingInMillis = totalTimeInMillis;
                updateTimerText(timeRemainingInMillis);
                progressTimer.setMax((int) totalTimeInMillis);
                progressTimer.setProgress((int) totalTimeInMillis);
            });
        }
        updateChipSelectionUI(durationChips.get(1));
    }

    private void updateChipSelectionUI(MaterialCardView selectedChip) {
        int maroon = ContextCompat.getColor(requireContext(), R.color.primary_maroon);
        int rose = ContextCompat.getColor(requireContext(), R.color.secondary_rose);
        for (MaterialCardView chip : durationChips) {
            TextView tv = (TextView) chip.getChildAt(0);
            if (chip == selectedChip) {
                chip.setCardBackgroundColor(maroon);
                tv.setTextColor(rose);
                chip.setStrokeWidth(0);
            } else {
                chip.setCardBackgroundColor(rose);
                tv.setTextColor(maroon);
                chip.setStrokeWidth(1);
                chip.setStrokeColor(maroon);
            }
        }
    }

    private void setupCustomDurationInput() {
        editCustomDuration.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            public void onTextChanged(CharSequence s, int start, int before, int count) {}
            public void afterTextChanged(Editable s) {
                if (!isTextWatcherActive) return;
                try {
                    int min = Integer.parseInt(s.toString());
                    if (min > 0) {
                        updateChipSelectionUI(null);
                        totalTimeInMillis = (long) min * 60000;
                        timeRemainingInMillis = totalTimeInMillis;
                        updateTimerText(timeRemainingInMillis);
                        progressTimer.setMax((int) totalTimeInMillis);
                        progressTimer.setProgress((int) totalTimeInMillis);
                    }
                } catch (Exception ignored) {}
            }
        });
    }

    private void setupExoPlayer() {
        exoPlayer = new ExoPlayer.Builder(requireContext()).build();
    }

    private void setupControlListeners() {
        btnReady.setOnClickListener(v -> startActiveState());
        buttonPlayPause.setOnClickListener(v -> {
            if (isTimerRunning) pauseSession(); else resumeSession();
        });
        buttonReload.setOnClickListener(v -> resetToStart());
        buttonFinishMeditation.setOnClickListener(v -> resetToStart());
    }

    private void startActiveState() {
        btnReady.setVisibility(View.GONE);
        layoutActiveControls.setVisibility(View.VISIBLE);
        isTimerRunning = true;
        buttonPlayPauseIcon.setImageResource(R.drawable.pause);

        updateRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isTimerRunning) return;
                timeRemainingInMillis -= 16;
                if (timeRemainingInMillis <= 0) {
                    layoutActiveControls.setVisibility(View.GONE);
                    layoutCompletedState.setVisibility(View.VISIBLE);
                } else {
                    updateTimerText(timeRemainingInMillis);
                    progressTimer.setProgress((int) timeRemainingInMillis);
                    handler.postDelayed(this, 16);
                }
            }
        };
        handler.post(updateRunnable);
        if (switchOmChanting.isChecked()) {
            exoPlayer.setMediaItem(MediaItem.fromUri(Uri.parse("android.resource://" + requireContext().getPackageName() + "/" + R.raw.satsang_sample)));
            exoPlayer.prepare();
            exoPlayer.play();
        }
    }

    private void pauseSession() {
        isTimerRunning = false;
        handler.removeCallbacks(updateRunnable);
        buttonPlayPauseIcon.setImageResource(R.drawable.play);
        exoPlayer.pause();
    }

    private void resumeSession() {
        isTimerRunning = true;
        handler.post(updateRunnable);
        buttonPlayPauseIcon.setImageResource(R.drawable.pause);
        exoPlayer.play();
    }

    private void resetToStart() {
        isTimerRunning = false;
        handler.removeCallbacks(updateRunnable);
        layoutActiveControls.setVisibility(View.GONE);
        layoutCompletedState.setVisibility(View.GONE);
        btnReady.setVisibility(View.VISIBLE);
        timeRemainingInMillis = totalTimeInMillis;
        updateTimerText(timeRemainingInMillis);
        progressTimer.setProgress((int) totalTimeInMillis);
        if (exoPlayer.isPlaying()) exoPlayer.stop();
        exoPlayer.seekTo(0);
        buttonPlayPauseIcon.setImageResource(R.drawable.play);
    }

    private void updateTimerText(long millis) {
        textTimerRemaining.setText(String.format(Locale.getDefault(), "%02d:%02d", (millis / 60000), ((millis / 1000) % 60)));
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        handler.removeCallbacks(updateRunnable);
        if (exoPlayer != null) {
            exoPlayer.release();
            exoPlayer = null;
        }
    }
}