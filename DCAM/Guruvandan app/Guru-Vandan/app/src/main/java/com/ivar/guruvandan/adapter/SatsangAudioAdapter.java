package com.ivar.guruvandan.adapter;

import android.annotation.SuppressLint;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.cardview.widget.CardView;
import androidx.recyclerview.widget.RecyclerView;

import com.ivar.guruvandan.R;
import com.ivar.guruvandan.data.model.SatsangAudio;

import java.util.List;
import java.util.concurrent.TimeUnit;

public class SatsangAudioAdapter extends RecyclerView.Adapter<SatsangAudioAdapter.AudioViewHolder> {

    private List<SatsangAudio> audioList;
    private int currentlyPlayingPosition = -1;
    private OnAudioClickListener listener;
    private RecyclerView attachedRecyclerView;

    public interface OnAudioClickListener {
        void onPlayPauseClicked(SatsangAudio audioTrack, boolean isNowPlaying);
        // onSeekTo has been removed as the user can no longer seek
    }

    public SatsangAudioAdapter(List<SatsangAudio> audioList, OnAudioClickListener listener) {
        this.audioList = audioList;
        this.listener = listener;
    }

    @Override
    public void onAttachedToRecyclerView(@NonNull RecyclerView recyclerView) {
        super.onAttachedToRecyclerView(recyclerView);
        this.attachedRecyclerView = recyclerView;
    }

    @Override
    public void onDetachedFromRecyclerView(@NonNull RecyclerView recyclerView) {
        super.onDetachedFromRecyclerView(recyclerView);
        this.attachedRecyclerView = null;
    }

    @NonNull
    @Override
    public AudioViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_satsang_audio, parent, false);
        return new AudioViewHolder(view);
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onBindViewHolder(@NonNull AudioViewHolder holder, int position) {
        SatsangAudio track = audioList.get(position);

        holder.textCategory.setText(track.getCategory());
        holder.textTitle.setText(track.getTitle());
        holder.textDescription.setText(track.getDescription());
        holder.textDuration.setText("Duration: " + track.getDuration());

        // ALWAYS set a default text so the TextView never collapses/disappears when recycled
        holder.timerText.setText("00:00 / " + track.getDuration());

        // Update icon and progress based on state
        if (currentlyPlayingPosition == position) {
            holder.btnIcon.setImageResource(R.drawable.pause);
        } else {
            holder.btnIcon.setImageResource(R.drawable.play);
            holder.seekBar.setProgress(0);
        }

        holder.btnContainer.setOnClickListener(v -> {
            int previousPosition = currentlyPlayingPosition;
            boolean isNowPlaying;

            if (currentlyPlayingPosition == position) {
                currentlyPlayingPosition = -1;
                isNowPlaying = false;
            } else {
                currentlyPlayingPosition = position;
                isNowPlaying = true;
            }

            if (previousPosition != -1) notifyItemChanged(previousPosition);
            notifyItemChanged(currentlyPlayingPosition == -1 ? position : currentlyPlayingPosition);

            listener.onPlayPauseClicked(track, isNowPlaying);
        });

        // Block all user touch interactions on the SeekBar to prevent skipping ahead
        holder.seekBar.setOnTouchListener((v, event) -> true);
    }

    @Override
    public int getItemCount() {
        return audioList != null ? audioList.size() : 0;
    }

    public void updateList(List<SatsangAudio> newList) {
        this.audioList = newList;
        this.currentlyPlayingPosition = -1;
        notifyDataSetChanged();
    }

    public void forceResetUI() {
        if (currentlyPlayingPosition != -1) {
            int oldPos = currentlyPlayingPosition;
            currentlyPlayingPosition = -1;
            notifyItemChanged(oldPos);
        }
    }

    public void updatePlaybackProgress(long currentPosition, long totalDuration) {
        if (currentlyPlayingPosition != -1 && attachedRecyclerView != null) {
            AudioViewHolder holder = (AudioViewHolder) attachedRecyclerView.findViewHolderForAdapterPosition(currentlyPlayingPosition);

            // Removed the isUserSeeking check since they can't seek anymore
            if (holder != null) {
                holder.updateProgress(currentPosition, totalDuration);
            }
        }
    }

    static class AudioViewHolder extends RecyclerView.ViewHolder {
        TextView textCategory, textTitle, textDescription, textDuration, timerText;
        CardView btnContainer;
        ImageView btnIcon;
        SeekBar seekBar;

        public AudioViewHolder(@NonNull View itemView) {
            super(itemView);
            textCategory = itemView.findViewById(R.id.text_audio_category);
            textTitle = itemView.findViewById(R.id.text_audio_title);
            textDescription = itemView.findViewById(R.id.text_audio_description);
            textDuration = itemView.findViewById(R.id.text_audio_duration);
            btnContainer = itemView.findViewById(R.id.button_play_pause);
            btnIcon = itemView.findViewById(R.id.button_play_pause_icon);
            seekBar = itemView.findViewById(R.id.seekbar_audio_progress);
            timerText = itemView.findViewById(R.id.text_timer);
        }

        public void updateProgress(long currentPos, long duration) {
            seekBar.setMax((int) Math.max(0, duration));
            seekBar.setProgress((int) Math.max(0, currentPos));
            updateProgressTextOnly(currentPos, duration);
        }

        @SuppressLint("DefaultLocale")
        public void updateProgressTextOnly(long currentPos, long duration) {
            long safeDuration = Math.max(0, duration);
            long safeCurrent = Math.max(0, currentPos);

            String time = String.format("%02d:%02d / %02d:%02d",
                    TimeUnit.MILLISECONDS.toMinutes(safeCurrent),
                    TimeUnit.MILLISECONDS.toSeconds(safeCurrent) % 60,
                    TimeUnit.MILLISECONDS.toMinutes(safeDuration),
                    TimeUnit.MILLISECONDS.toSeconds(safeDuration) % 60);
            timerText.setText(time);
        }
    }
}