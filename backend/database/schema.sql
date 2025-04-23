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

CREATE TABLE Portfolios (
  id INT PRIMARY KEY IDENTITY(1,1),
  user_id INT NOT NULL, -- refererer til Users
  name NVARCHAR(100) NOT NULL UNIQUE, -- navn på portefølje, må ikke være NULL
  created_at DATETIME DEFAULT GETDATE(), -- oprettelsesdato, default er nuværende tidspunkt 
  FOREIGN KEY (user_id) REFERENCES Users(id) -- refererer til Users, user_id skal være en gyldig id fra Users
);

CREATE TABLE Stocks (
  id INT PRIMARY KEY IDENTITY(1,1),
  user_id INT NOT NULL, -- refererer til Users
  name NVARCHAR(100) NOT NULL, -- navn på værdipapiret, må ikke være NULL
  type NVARCHAR(50) CHECK (type IN ('aktie', 'obligation', 'fond')), -- type af værdipapir, må ikke være NULL og skal være enten 'aktie', 'obligation' eller 'fond'
  quantity INT NOT NULL CHECK (quantity >= 0), -- antal værdipapirer, må ikke være NULL og skal være >= 0
  price DECIMAL(18,2) NOT NULL CHECK (price >= 0), -- pris pr. værdipapir, må ikke være NULL og skal være >= 0
  created_at DATETIME DEFAULT GETDATE(), -- oprettelsesdato, default er nuværende tidspunkt 
  FOREIGN KEY (user_id) REFERENCES Users(id) -- refererer til Users, user_id skal være en gyldig id fra Users
);


CREATE TABLE Transactions (
  id INT PRIMARY KEY IDENTITY(1,1),
  account_id INT NOT NULL, -- refererer til Accounts
  amount DECIMAL(18,2) NOT NULL, -- beløb, må ikke være NULL
  transaction_type NVARCHAR(10) CHECK (transaction_type IN ('debit', 'credit')), -- type af transaktion, må ikke være NULL og skal være enten 'debit' eller 'credit'
  description NVARCHAR(255), -- beskrivelse af transaktionen
  created_at DATETIME DEFAULT GETDATE(), -- oprettelsesdato, default er nuværende tidspunkt 
  FOREIGN KEY (account_id) REFERENCES Accounts(id) -- refererer til Accounts, account_id skal være en gyldig id fra Accounts
);