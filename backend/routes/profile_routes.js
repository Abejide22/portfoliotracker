const express = require("express"); // Importer express
const router = express.Router(); // Opretter en router
const {pool, poolConnect, sql} = require("../database/database"); // Importerer databaseforbindelsen

router.use(express.urlencoded({extended: true})); // Middleware til at parse URL-encoded data

// Funktion til at opdatere adgangskoden
async function updatePassword(pool, userId, newPassword, confirmPassword) {
  if (newPassword !== confirmPassword) {  // hvis adgangskoderne ikke matcher
    return {success: false, error: "Passwords does not match."}; // returnerer fejlbesked
  }

  try { // prøver følgende kode
    await pool // venter på at poolConnect er klar
      .request() // sender en forespørgsel til databasen
      .input("userId", sql.Int, userId) // tilføjer inputparameteren userId
      .input("password", sql.NVarChar, newPassword) // tilføjer inputparameteren password
      .query("UPDATE Users SET password = @password WHERE id = @userId"); // opdaterer password i SQL-databasen

    return {success: true, message: "The password has been updated!"}; // returnerer succesbesked
  } catch (err) { // hvis der opstår en fejl
    console.error("Fejl ved opdatering af adgangskode:", err); // logger fejlen
    return {success: false, error: "Noget gik galt."}; // returnerer fejlbesked
  }
}

// GET: Profile-side
router.get("/profile", (req, res) => {
  if (!req.session.userId) return res.redirect("/login"); // Hvis brugeren ikke er logget ind, omdirigeres de til login-siden
  const userId = req.session.userId; // Hent brugerens id fra sessionen
  res.render("profile", {userId, error: null, success: null}); // Renderer profilen uden fejl eller succesbesked
});

// POST: Opdater adgangskode via form
router.post("/profile/update-password", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login"); // Sessionkontrol: kun loggede brugere kan opdatere adgangskode
  const userId = req.session.userId; // Brugerens ID hentes direkte fra session
  const { newPassword, confirmPassword } = req.body; // Hent adgangskoder fra formularen

  // Brug funktionen updatePassword
  const result = await updatePassword(pool, userId, newPassword, confirmPassword);

  if (!result.success) { // Hvis opdateringen fejler
    return res.render("profile", {userId, error: result.error, success: null}); // Render profilen med fejlbesked
  }

  res.render("profile", {userId, success: result.message, error: null}); // Render profilen med succesbesked
});

// PUT: Opdater adgangskode via JSON API
router.put("/profile/update-password", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" }); // Sessionkontrol for API-kald
  const userId = req.session.userId; // Brugerens ID hentes direkte fra session
  const { newPassword, confirmPassword } = req.body;

  // Brug funktionen updatePassword
  const result = await updatePassword(pool, userId, newPassword, confirmPassword);

  if (!result.success) { // Hvis opdateringen fejler
    return res.status(400).json({error: result.error}); // Returner fejlbesked som JSON
  }

  res.status(200).json({success: result.message}); // Returner succesbesked som JSON
});

module.exports = router;