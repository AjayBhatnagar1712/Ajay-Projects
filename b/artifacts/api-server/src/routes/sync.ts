import { Router, type IRouter } from "express";
import {
  accountHasProfile,
  getAccountData,
  getAccountSummariesForPhone,
  getRolesForPhone,
  normalizePhone,
  setAccountDataBulk,
  setAccountDataKey,
} from "../lib/accountStore";
import { requireSyncAccountAuth } from "../middlewares/syncAuth";

const router: IRouter = Router();

router.get("/sync/accounts/:phone/roles", async (req, res) => {
  try {
    const phone = normalizePhone(String(req.params.phone ?? ""));
    if (phone.length !== 10) {
      res.status(400).json({ error: "Invalid phone" });
      return;
    }
    const roles = await getRolesForPhone(phone);
    res.json({ phone, roles });
  } catch (err) {
    res.status(500).json({ error: "Failed to list roles", detail: String(err) });
  }
});

router.get("/sync/accounts/:phone/summaries", async (req, res) => {
  try {
    const phone = normalizePhone(String(req.params.phone ?? ""));
    if (phone.length !== 10) {
      res.status(400).json({ error: "Invalid phone" });
      return;
    }
    const accounts = await getAccountSummariesForPhone(phone);
    res.json({ phone, accounts });
  } catch (err) {
    res.status(500).json({ error: "Failed to list account summaries", detail: String(err) });
  }
});

router.get("/sync/accounts/:phone/:role/exists", async (req, res) => {
  try {
    const phone = normalizePhone(String(req.params.phone ?? ""));
    const role = String(req.params.role ?? "");
    if (phone.length !== 10 || !role) {
      res.status(400).json({ error: "Invalid phone or role" });
      return;
    }
    const exists = await accountHasProfile(phone, role);
    res.json({ phone, role, exists });
  } catch (err) {
    res.status(500).json({ error: "Failed to check account", detail: String(err) });
  }
});

router.get("/sync/accounts/:phone/:role", requireSyncAccountAuth, async (req, res) => {
  try {
    const phone = normalizePhone(String(req.params.phone ?? ""));
    const role = String(req.params.role ?? "");
    if (phone.length !== 10 || !role) {
      res.status(400).json({ error: "Invalid phone or role" });
      return;
    }
    const data = await getAccountData(phone, role);
    if (!data.profile) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json({ phone, role, data });
  } catch (err) {
    res.status(500).json({ error: "Failed to load account", detail: String(err) });
  }
});

router.put("/sync/accounts/:phone/:role/:dataKey", requireSyncAccountAuth, async (req, res) => {
  try {
    const phone = normalizePhone(String(req.params.phone ?? ""));
    const role = String(req.params.role ?? "");
    const dataKey = String(req.params.dataKey ?? "");
    const value = typeof req.body?.value === "string" ? req.body.value : null;
    if (phone.length !== 10 || !role || !dataKey || value === null) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    await setAccountDataKey(phone, role, dataKey, value);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save data", detail: String(err) });
  }
});

router.put("/sync/accounts/:phone/:role", requireSyncAccountAuth, async (req, res) => {
  try {
    const phone = normalizePhone(String(req.params.phone ?? ""));
    const role = String(req.params.role ?? "");
    const entries = req.body?.entries as Record<string, string> | undefined;
    if (phone.length !== 10 || !role || !entries || typeof entries !== "object") {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    await setAccountDataBulk(phone, role, entries);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save data", detail: String(err) });
  }
});

export default router;
