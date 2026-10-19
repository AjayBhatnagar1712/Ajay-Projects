package com.ivar.guruvandan.data.network;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.Window;

import com.ivar.guruvandan.R;

public class NetworkDialogHelper {

    private Dialog noInternetDialog;

    public void showDialog(Context context) {
        if (noInternetDialog == null) {
            noInternetDialog = new Dialog(context);
            noInternetDialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            noInternetDialog.setContentView(R.layout.dialog_no_internet);

            if (noInternetDialog.getWindow() != null) {
                noInternetDialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            }

            // This is the line that physically blocks the user from clicking around
            noInternetDialog.setCancelable(false);
        }

        if (!noInternetDialog.isShowing()) {
            noInternetDialog.show();
        }
    }

    public void hideDialog() {
        if (noInternetDialog != null && noInternetDialog.isShowing()) {
            noInternetDialog.dismiss();
        }
    }
}
