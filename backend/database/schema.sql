CREATE TABLE Users (
    id INT PRIMARY KEY IDENTITY(1,1), -- primær nøgle
    username NVARCHAR(50) NOT NULL UNIQUE, -- brugernavn, må ikke være NULL og skal være unikt
    email NVARCHAR(100) NOT NULL UNIQUE, -- email, må ikke være NULL og skal være unikt
    password NVARCHAR(255) NOT NULL, -- password, må ikke være NULL
    created_at DATETIME DEFAULT GETDATE() -- oprettelsesdato, default er nuværende tidspunkt
);

CREATE TABLE Accounts (
  id INT PRIMARY KEY IDENTITY(1,1),
  user_id INT NOT NULL, -- refererer til Users
  name NVARCHAR(100) NOT NULL, -- navn på konto, må ikke være NULL   
  currency NVARCHAR(10) NOT NULL, -- valuta på konto, må ikke være NULL
  balance DECIMAL(18,2) DEFAULT 0, -- balancen, default er 0
  created_at DATETIME DEFAULT GETDATE(), -- oprettelsesdato, default er nuværende tidspunkt 
  bank NVARCHAR(100), -- bankens navn, som kontoen er tilknyttet til
  FOREIGN KEY (user_id) REFERENCES Users(id) -- refererer til Users, user_id skal være en gyldig id fra Users
);