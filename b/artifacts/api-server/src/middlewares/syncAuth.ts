import type { RequestHandler } from "express";
import { assertSyncAccountAuth } from "@workspace/auth-server";
import { normalizePhone } from "../lib/accountStore";

/** Requires Supabase JWT (when configured) matching :phone on the route. */
export const requireSyncAccountAuth: RequestHandler = async (req, res, next) => {
  try {
    const phone = normalizePhone(String(req.params.phone ?? ""));
    const auth = await assertSyncAccountAuth(req.headers.authorization, phone);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};
