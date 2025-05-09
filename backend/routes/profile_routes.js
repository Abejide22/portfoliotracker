const express = require("express");
const router = express.Router();
const { pool, poolConnect, sql } = require("../database/database");

router.use(express.urlencoded({ extended: true }));

// Funktion til at opdatere adgangskoden
async function updatePassword(pool, userId, newPassword, confirmPassword) {
  if (newPassword !== confirmPassword) {
    return { success: false, error: "Adgangskoderne matcher ikke." };
  }

  try {
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("password", sql.NVarChar, newPassword)
      .query("UPDATE Users SET password = @password WHERE id = @userId");

    return { success: true, message: "Adgangskoden er opdateret!" };
  } catch (err) {
    console.error("Fejl ved opdatering af adgangskode:", err);
    return { success: false, error: "Noget gik galt." };
  }
}

// GET: Profile-side
router.get("/profile", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const userId = req.session.userId;
  res.render("profile", { userId, error: null, success: null });
});

// POST: Opdater adgangskode via form
router.post("/profile/update-password", async (req, res) => {
  const { userId, newPassword, confirmPassword } = req.body;

  // Brug funktionen updatePassword
  const result = await updatePassword(pool, userId, newPassword, confirmPassword);

  if (!result.success) {
    return res.render("profile", { userId, error: result.error, success: null });
  }

  res.render("profile", { userId, success: result.message, error: null });
});

// PUT: Opdater adgangskode via JSON API
router.put("/profile/update-password", async (req, res) => {
  const { userId, newPassword, confirmPassword } = req.body;

  // Brug funktionen updatePassword
  const result = await updatePassword(pool, userId, newPassword, confirmPassword);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.status(200).json({ success: result.message });
});

module.exports = router;