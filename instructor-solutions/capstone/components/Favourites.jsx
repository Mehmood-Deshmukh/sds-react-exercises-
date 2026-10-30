function Favourites({ favourites, onRemove }) {
  return (
    <section className="stack">
      <h3>Favourites</h3>
      {favourites.length === 0 && <p className="muted">No favourites yet. Save a joke you like.</p>}
      <ul className="list">
        {favourites.map((joke) => (
          <li key={joke.id} className="card cart-item">
            <div>
              <p className="setup">{joke.setup}</p>
              <p className="punchline">{joke.punchline}</p>
            </div>
            <button className="btn btn-secondary btn-small" onClick={() => onRemove(joke.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default Favourites;
