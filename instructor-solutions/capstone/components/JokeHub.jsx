import { useEffect, useState } from "react";
import { API_URL } from "../api";
import JokeCard from "./JokeCard";

function JokeHub({ onSave }) {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("any");
  const [joke, setJoke] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/jokes/categories`)
      .then((response) => response.json())
      .then((data) => setCategories(data));
  }, []);

  function handleGetJoke() {
    const query = category === "any" ? "" : `?category=${category}`;
    fetch(`${API_URL}/api/jokes/random${query}`)
      .then((response) => response.json())
      .then((data) => setJoke(data));
  }

  return (
    <section className="card stack">
      <div className="row">
        {["any", ...categories].map((name) => (
          <button
            key={name}
            className={name === category ? "chip active" : "chip"}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="btn" onClick={handleGetJoke}>
          Get a joke
        </button>
        {joke !== null && (
          <button className="btn btn-secondary" onClick={() => onSave(joke)}>
            ⭐ Save
          </button>
        )}
      </div>
      {joke !== null && <JokeCard key={joke.id} setup={joke.setup} punchline={joke.punchline} />}
    </section>
  );
}

export default JokeHub;
