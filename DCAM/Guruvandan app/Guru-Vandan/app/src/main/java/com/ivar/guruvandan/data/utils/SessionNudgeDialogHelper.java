package com.ivar.guruvandan.data.utils;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;

import com.ivar.guruvandan.R;

public class SessionNudgeDialogHelper {

    private Dialog nudgeDialog;

    // We create an interface so the dialog can tell the Activity which button was clicked
    public interface NudgeDialogListener {
        void onKickOutConfirmed();
        void onCancel();
    }

    public void showDialog(Context context, NudgeDialogListener listener) {
        // Only build it if it doesn't exist yet
        if (nudgeDialog == null) {
            nudgeDialog = new Dialog(context);
            nudgeDialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            nudgeDialog.setContentView(R.layout.dialog_multiple_device_login_prompt);

            if (nudgeDialog.getWindow() != null) {
                // Make the background transparent to show your rounded corners
                nudgeDialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
                // Ensure it stretches nicely across the screen with your 20dp margins
                nudgeDialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            }

            nudgeDialog.setCancelable(false); // Force a choice

            // Wire up the buttons
            Button btnYes = nudgeDialog.findViewById(R.id.button_kick_out);
            Button btnCancel = nudgeDialog.findViewById(R.id.button_cancel);

            btnYes.setOnClickListener(v -> {
                hideDialog();
                if (listener != null) {
                    listener.onKickOutConfirmed(); // Tell the Activity they said YES
                }
            });

            btnCancel.setOnClickListener(v -> {
                hideDialog();
                if (listener != null) {
                    listener.onCancel(); // Tell the Activity they said NO
                }
            });
        }

        if (!nudgeDialog.isShowing()) {
            nudgeDialog.show();
        }
    }

    public void hideDialog() {
        if (nudgeDialog != null && nudgeDialog.isShowing()) {
            nudgeDialog.dismiss();
        }
    }
}