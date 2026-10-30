import { useEffect, useState } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import JokeHub from "./components/JokeHub";
import Favourites from "./components/Favourites";

function App() {
  const [favourites, setFavourites] = useState(() => {
    const saved = localStorage.getItem("favourites");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("favourites", JSON.stringify(favourites));
  }, [favourites]);

  function saveJoke(joke) {
    if (favourites.some((saved) => saved.id === joke.id)) return;
    setFavourites([...favourites, joke]);
  }

  function removeJoke(id) {
    setFavourites(favourites.filter((saved) => saved.id !== id));
  }

  return (
    <div className="app">
      <Header savedCount={favourites.length} />
      <main className="main">
        <JokeHub onSave={saveJoke} />
        <Favourites favourites={favourites} onRemove={removeJoke} />
      </main>
      <Footer />
    </div>
  );
}

export default App;
