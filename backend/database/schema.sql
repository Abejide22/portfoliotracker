CREATE TABLE Users (
    id INT PRIMARY KEY IDENTITY(1,1), -- primær nøgle
    username NVARCHAR(50) NOT NULL UNIQUE, -- brugernavn, må ikke være NULL og skal være unikt
    email NVARCHAR(100) NOT NULL UNIQUE, -- email, må ikke være NULL og skal være unikt
    password NVARCHAR(255) NOT NULL, -- password, må ikke være NULL
    created_at DATETIME DEFAULT GETDATE() -- oprettelsesdato, default er nuværende tidspunkt
);

CREATE TABLE Accounts (
  konto_id INT PRIMARY KEY IDENTITY(1,1), -- primær nøgle
  user_id INT NOT NULL, -- refererer til Users
  name NVARCHAR(100) NOT NULL, -- navn på konto, må ikke være NULL
  currency NVARCHAR(10) NOT NULL, -- valuta på konto, må ikke være NULL
  balance DECIMAL(18,2) DEFAULT 0, -- balancen, default er 0
  created_at DATETIME DEFAULT GETDATE(), -- oprettelsesdato, default er nuværende tidspunkt
  bank NVARCHAR(100), -- bankens navn, som kontoen er tilknyttet til
  status NVARCHAR(10) DEFAULT 'åben' CHECK (status IN ('åben', 'lukket')), -- status, enten 'åben' eller 'lukket'
  closed_at DATETIME NULL, -- dato for lukning af konto, kan være NULL
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
  portfolio_id INT NOT NULL, -- refererer til Portfolios
  name NVARCHAR(100) NOT NULL, -- navn på værdipapiret, må ikke være NULL
  type NVARCHAR(50) CHECK (type IN ('aktie', 'obligation', 'fond')), -- type af værdipapir, må ikke være NULL og skal være enten 'aktie', 'obligation' eller 'fond'
  quantity INT NOT NULL CHECK (quantity >= 0), -- antal værdipapirer, må ikke være NULL og skal være >= 0
  price DECIMAL(18,2) NOT NULL CHECK (price >= 0), -- pris pr. værdipapir, må ikke være NULL og skal være >= 0
  created_at DATETIME DEFAULT GETDATE(), -- oprettelsesdato, default er nuværende tidspunkt 
  FOREIGN KEY (user_id) REFERENCES Users(id), -- refererer til Users, user_id skal være en gyldig id fra Users
  FOREIGN KEY (portfolio_id) REFERENCES Portfolios(id) -- refererer til Portfolios, portfolio_id skal være en gyldig id fra Portfolios
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

CREATE TABLE Trades (
  id INT PRIMARY KEY IDENTITY(1,1),
  stock_id INT NOT NULL, -- refererer til Stocks
  buy_price DECIMAL(18,2) NOT NULL CHECK (buy_price >= 0), -- købspris pr. værdipapir, må ikke være NULL og skal være >= 0
  sell_price DECIMAL(18,2) CHECK (sell_price >= 0), -- salgspris pr. værdipapir, må være NULL eller >= 0
  quantity_bought INT NOT NULL CHECK (quantity_bought >= 0), -- antal købte værdipapirer, må ikke være NULL og skal være >= 0
  quantity_sold INT CHECK (quantity_sold >= 0), -- antal solgte værdipapirer, må være NULL eller >= 0
  buy_date DATETIME DEFAULT GETDATE(), -- købsdato, default er nuværende tidspunkt
  sell_date DATETIME DEFAULT GETDATE(), -- salgsdato, default er nuværende tidspunkt
  FOREIGN KEY (stock_id) REFERENCES Stocks(id) -- refererer til Stocks, stock_id skal være en gyldig id fra Stocks
);
