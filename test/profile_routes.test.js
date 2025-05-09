const { expect } = require("chai"); // Importer chai for at kunne bruge expect
const { updatePassword } = require("../backend/routes/profile_routes"); // Importer funktionen

describe("updatePassword", () => {
  let mockPool;

  beforeEach(() => {
    // Mock pool
    mockPool = {
      request: () => ({
        input: () => ({
          input: () => ({
            query: async () => {}, // Mock en succesfuld databaseforespørgsel
          }),
        }),
      }),
    };
  });

  it("skal returnere fejl, hvis adgangskoderne ikke matcher", async () => {
    const result = await updatePassword(mockPool, 1, "newPassword", "forkertPassword"); // Kalder funktionen med forskellige adgangskoder

    expect(result.success).to.be.false; // Forventer, at success er false
    expect(result.error).to.equal("Adgangskoderne matcher ikke."); // Forventer en fejlbesked om, at adgangskoderne ikke matcher
  });

  it("skal returnere succes, hvis adgangskoden opdateres korrekt", async () => {
    const result = await updatePassword(mockPool, 1, "newPassword", "newPassword"); // Kalder funktionen med matchende adgangskoder

    expect(result.success).to.be.true; // Forventer, at success er true
    expect(result.message).to.equal("Adgangskoden er opdateret!"); // Forventer en succesbesked om, at adgangskoden er opdateret
  });

  it("skal returnere fejl, hvis der opstår en databasefejl", async () => {
    // Simuler en databasefejl
    mockPool.request = () => ({ // Mocker request-metoden
      input: () => ({ 
        input: () => ({ 
          query: async () => { // Mocker query-metoden, som simulerer en databaseforespørgsel
            throw new Error("Databasefejl"); // Kaster en fejl for at simulere en databasefejl
          },
        }),
      }),
    });

    const result = await updatePassword(mockPool, 1, "newPassword", "newPassword"); // Kalder funktionen med matchende adgangskoder

    expect(result.success).to.be.false; // Forventer, at success er false
    expect(result.error).to.equal("Noget gik galt."); // Forventer en generisk fejlbesked om, at noget gik galt
  });
});