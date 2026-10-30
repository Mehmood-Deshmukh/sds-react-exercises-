function Header({ savedCount }) {
  return (
    <header className="header row" style={{ justifyContent: "space-between" }}>
      <div>
        <h1>😂 Joke Hub</h1>
        <p>My React playground</p>
      </div>
      <span className="badge">⭐ {savedCount} saved</span>
    </header>
  );
}

export default Header;
