package com.ivar.guruvandan.ui.dashboard;

import android.annotation.SuppressLint;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButtonToggleGroup;
import com.ivar.guruvandan.R;
import com.ivar.guruvandan.adapter.SatsangAudioAdapter;
import com.ivar.guruvandan.data.model.SatsangAudio;

import androidx.media3.common.MediaItem;
import androidx.media3.exoplayer.ExoPlayer;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.concurrent.TimeUnit;

public class SatsangFragment extends Fragment implements SatsangAudioAdapter.OnAudioClickListener {

    private RecyclerView recyclerView;
    private SatsangAudioAdapter adapter;
    private MaterialButtonToggleGroup toggleGroup;

    private ExoPlayer exoPlayer;
    private SatsangAudio currentTrack;

    // Tools for tracking progress
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (exoPlayer != null) {
                long currentPosition = Math.max(0, exoPlayer.getCurrentPosition());
                long totalDuration = Math.max(0, exoPlayer.getDuration());

                // Update the adapter
                adapter.updatePlaybackProgress(currentPosition, totalDuration);

                // Use getPlayWhenReady() instead of isPlaying().
                // This ensures the loop survives the initial buffering phase.
                if (exoPlayer.getPlayWhenReady()) {
                    handler.postDelayed(this, 100);
                }
            }
        }
    };

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_satsang, container, false);

        recyclerView = view.findViewById(R.id.recycler_satsang_audio);
        toggleGroup = view.findViewById(R.id.session_toggle_group);

        setupRecyclerView();
        setupToggleGroup();
        setupExoPlayer();
        setTimeBasedDefault();

        return view;
    }

    private void setupRecyclerView() {
        recyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new SatsangAudioAdapter(new ArrayList<>(), this);
        recyclerView.setAdapter(adapter);
    }

    private void setupExoPlayer() {
        exoPlayer = new ExoPlayer.Builder(requireContext()).build();
    }

    private void setupToggleGroup() {
        toggleGroup.addOnButtonCheckedListener((group, checkedId, isChecked) -> {
            if (isChecked) {
                pauseAudioSafely();
                if (checkedId == R.id.btn_morning) {
                    adapter.updateList(getMorningTracks());
                } else if (checkedId == R.id.btn_evening) {
                    adapter.updateList(getEveningTracks());
                }
            }
        });
    }

    private void setTimeBasedDefault() {
        int currentHour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (currentHour >= 3 && currentHour < 12) {
            toggleGroup.check(R.id.btn_morning);
            adapter.updateList(getMorningTracks());
        } else {
            toggleGroup.check(R.id.btn_evening);
            adapter.updateList(getEveningTracks());
        }
    }

    @Override
    public void onPlayPauseClicked(SatsangAudio audioTrack, boolean isNowPlaying) {
        if (isNowPlaying) {
            if (currentTrack == null || currentTrack.getAudioResId() != audioTrack.getAudioResId()) {
                currentTrack = audioTrack;
                String uriPath = "android.resource://" + requireContext().getPackageName() + "/" + audioTrack.getAudioResId();
                exoPlayer.setMediaItem(MediaItem.fromUri(Uri.parse(uriPath)));
                exoPlayer.prepare();
            }
            exoPlayer.play();

            // Clean up any old callbacks to prevent double-speed updates, then start fresh
            handler.removeCallbacks(progressRunnable);
            handler.post(progressRunnable);
        } else {
            exoPlayer.pause();
            handler.removeCallbacks(progressRunnable);
        }
    }

    private void pauseAudioSafely() {
        if (exoPlayer != null && exoPlayer.isPlaying()) {
            exoPlayer.pause();
            handler.removeCallbacks(progressRunnable);
            adapter.forceResetUI();
        }
    }

    @SuppressLint("DefaultLocale")
    private String getAudioDuration(int audioResId) {
        try {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            String uriPath = "android.resource://" + requireContext().getPackageName() + "/" + audioResId;
            retriever.setDataSource(requireContext(), Uri.parse(uriPath));

            String timeString = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            long timeInMillis = Long.parseLong(timeString);
            retriever.release();

            return String.format("%02d:%02d",
                    TimeUnit.MILLISECONDS.toMinutes(timeInMillis),
                    TimeUnit.MILLISECONDS.toSeconds(timeInMillis) % 60);
        } catch (Exception e) {
            e.printStackTrace();
            return "00:00";
        }
    }

    private List<SatsangAudio> getMorningTracks() {
        List<SatsangAudio> list = new ArrayList<>();
        int resId = R.raw.satsang_sample;
        list.add(new SatsangAudio("MORNING SATSANG", "Morning Aarti", "Sacred morning gathering.", getAudioDuration(resId), resId));
        return list;
    }

    private List<SatsangAudio> getEveningTracks() {
        List<SatsangAudio> list = new ArrayList<>();
        int resId = R.raw.satsang_sample;
        list.add(new SatsangAudio("EVENING SATSANG", "Evening Aarti", "Peaceful evening reflections.", getAudioDuration(resId), resId));
        return list;
    }

    @Override
    public void onPause() {
        super.onPause();
        pauseAudioSafely();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        handler.removeCallbacks(progressRunnable);
        if (exoPlayer != null) {
            exoPlayer.release();
            exoPlayer = null;
        }
    }
}