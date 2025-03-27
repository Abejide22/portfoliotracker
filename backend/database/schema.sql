CREATE TABLE Users (
    id INT PRIMARY KEY IDENTITY(1,1), -- primær nøgle
    username NVARCHAR(50) NOT NULL UNIQUE, -- brugernavn, må ikke være NULL og skal være unikt
    email NVARCHAR(100) NOT NULL UNIQUE, -- email, må ikke være NULL og skal være unikt
    password NVARCHAR(255) NOT NULL, -- password, må ikke være NULL
    created_at DATETIME DEFAULT GETDATE() -- oprettelsesdato, default er nuværende tidspunkt
);

