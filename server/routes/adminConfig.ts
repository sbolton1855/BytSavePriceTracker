
import { Router } from "express";
import { db } from "../db";
import { config } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getGlobalConfig } from "../storage";

const router = Router();

// Get current global cooldown
router.get("/cooldown", async (req, res) => {
  try {
    const cooldownHours = await getGlobalConfig("cooldown_hours") || "72";
    res.json({ cooldown_hours: parseInt(cooldownHours) });
  } catch (error) {
    console.error("Error fetching cooldown config:", error);
    res.status(500).json({ error: "Failed to fetch cooldown configuration" });
  }
});

// Update global cooldown
router.patch("/cooldown", async (req, res) => {
  try {
    const { hours } = req.body;
    
    if (!hours || isNaN(parseInt(hours)) || parseInt(hours) < 1) {
      return res.status(400).json({ error: "Invalid cooldown hours. Must be a positive number." });
    }

    // Update or insert cooldown configuration
    await db
      .insert(config)
      .values({
        key: "cooldown_hours",
        value: hours.toString()
      })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: hours.toString() }
      });

    console.log(`✅ Global cooldown updated to ${hours} hours`);
    res.json({ success: true, cooldown_hours: parseInt(hours) });
  } catch (error) {
    console.error("Error updating cooldown config:", error);
    res.status(500).json({ error: "Failed to update cooldown configuration" });
  }
});

export default router;
