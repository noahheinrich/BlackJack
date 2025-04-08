import React, { useState, useEffect } from "react";
import Hand from "./Hand";
import jsonData from "../deck.json";
import "./styles/App.css";
import styles from "./styles/Status.module.css";

// Définition des états du jeu
enum GameState {
  init, // État initial
  userTurn, // Tour des joueurs
  dealerTurn, // Tour du dealer
  gameEnd, // Fin de partie
}

// Types de distribution de cartes
enum Deal {
  user, // Carte pour un joueur
  dealer, // Carte visible pour le dealer
  hidden, // Carte cachée pour le dealer
}

// Messages d'état du jeu
enum Message {
  bet = "Place a Bet!",
  hitStand = "Hit or Stand?",
  bust = "Bust!",
  userWin = "You Win!",
  dealerWin = "Dealer Wins!",
  tie = "Tie!",
}

const App: React.FC = () => {

  // État pour contrôler l'affichage de l'écran de démarrage
  const [gameStarted, setGameStarted] = useState(false);

  // Initialisation du deck à partir du fichier JSON
  const data = JSON.parse(JSON.stringify(jsonData.cards));
  const [deck, setDeck]: any[] = useState(data);

  // État pour stocker les joueurs récupérés de l'API
  const [players, setPlayers] = useState<
    { uuid: string; team: string; hit: string; stand: string }[]
  >([]);

  // Stockage des mains de chaque joueur
  const [playerHands, setPlayerHands] = useState<{ [key: string]: any[] }>({});

  // États relatifs au dealer
  const [dealerCards, setDealerCards]: any[] = useState([]);
  const [dealerScore, setDealerScore] = useState(0);
  const [dealerCount, setDealerCount] = useState(0);
  const [dealerTurnStarted, setDealerTurnStarted] = useState(false);

  // Stockage des résultats et états précédents
  const [playerResults, setPlayerResults] = useState<{ [key: string]: string }>(
    {}
  );
  const [previousHits, setPreviousHits] = useState<{ [key: string]: number }>(
    {}
  );
  const [previousPlayers, setPreviousPlayers] = useState<{
    [key: string]: boolean;
  }>({});

  // Référence pour les scores des joueurs (permet d'accéder aux valeurs à jour dans les effets)
  const playerScoresRef = React.useRef<{ [key: string]: number }>({});

  // État actuel du jeu
  const [gameState, setGameState] = useState(GameState.init);

  // Fonction pour démarrer le jeu quand l'utilisateur clique sur le bouton
  const startGame = () => {
    setGameStarted(true);
    setGameState(GameState.init);
  };

  // Effet pour récupérer les joueurs depuis l'API
  useEffect(() => {
    const fetchPlayers = async () => {
      if (!gameStarted) return; // Ne charge les joueurs que si le jeu a commencé

      try {
        console.log("Fetching players...");
        const response = await fetch("http://localhost:8080/api/data");
        const textResponse = await response.text();
        console.log("Raw response:", textResponse);
        const newPlayers = JSON.parse(textResponse) as {
          uuid: string;
          team: string;
          hit: string;
          stand: string;
        }[];
        console.log("Players fetched:", newPlayers);

        // Filtre pour n'avoir qu'un joueur par équipe
        const teamMap = new Map<
          string,
          { uuid: string; team: string; hit: string; stand: string }
        >();
        newPlayers.forEach((player) => {
          if (!teamMap.has(player.team)) {
            teamMap.set(player.team, player);
          }
        });

        setPlayers(Array.from(teamMap.values()));
      } catch (error) {
        console.error("Error fetching players:", error);
      }
    };

    if (gameStarted) {
      fetchPlayers();
      // Met à jour les joueurs toutes les 5 secondes pour détecter les actions
      const interval = setInterval(fetchPlayers, 2000);
      return () => clearInterval(interval);
    }
  }, [gameStarted]);

  // Initialisation du jeu - distribution des cartes initiales
  useEffect(() => {
    console.log("Game state changed:", gameState);
    if (gameState === GameState.init && gameStarted) {
      // Donne une carte au dealer
      drawCard(Deal.dealer);
      // Donne 2 cartes à chaque joueur
      players.forEach((player) => {
        drawCard(Deal.user, player.uuid);
        drawCard(Deal.user, player.uuid);
      });
      setGameState(GameState.userTurn);
    }
  }, [gameState, gameStarted, players]);

  // Détection quand tous les joueurs ont "stand" pour passer au tour du dealer
  useEffect(() => {
    const allPlayersStand = players.every((player) => player.stand === "1");
    if (
      allPlayersStand &&
      gameState === GameState.userTurn &&
      !dealerTurnStarted
    ) {
      setDealerTurnStarted(true);
      setGameState(GameState.dealerTurn);
      revealCard();
    }
  }, [players, gameState]);

  // Calcul du score du dealer quand ses cartes changent
  useEffect(() => {
    console.log("Dealer cards updated:", dealerCards);
    const score = calculate(dealerCards);
    setDealerScore(score);
    setDealerCount(dealerCount + 1);
  }, [dealerCards]);

  // Logique du tour du dealer (tire jusqu'à >=17, puis vérifie les gagnants)
  useEffect(() => {
    if (gameState === GameState.dealerTurn) {
      if (dealerScore >= 17) {
        checkWin();
        setGameState(GameState.gameEnd);
        // Attente de 7 secondes avant de réinitialiser pour une nouvelle partie
        setTimeout(async () => {
          await resetPlayerCounters();
          resetGame();
        }, 7000);
      } else {
        drawCard(Deal.dealer);
      }
    }
  }, [dealerScore, gameState]);

  // Gestion des actions "Hit" et "Stand" des joueurs
  useEffect(() => {
    const newPlayers: { [key: string]: boolean } = {};

    players.forEach((player) => {
      const playerId = player.uuid;
      const currentHit = parseInt(player.hit, 10);
      const previousHit = previousHits[playerId] || 0;
      const playerScore = playerScoresRef.current[playerId] || 0;

      // Donne une nouvelle carte si le joueur a "hit" et n'a pas dépassé 21
      if (
        playerScore <= 21 &&
        currentHit > previousHit &&
        player.stand !== "1"
      ) {
        console.log(`Player ${playerId} hits with score: ${playerScore}`);
        drawCard(Deal.user, playerId);

        setPreviousHits((prev) => ({
          ...prev,
          [playerId]: currentHit,
        }));
      }

      // Initialisation pour les nouveaux joueurs
      if (!previousPlayers[playerId]) {
        console.log(`New player detected: ${playerId}`);
        drawCard(Deal.user, playerId);
        drawCard(Deal.user, playerId);
      }

      newPlayers[playerId] = true;
    });

    setPreviousPlayers(newPlayers);
  }, [players, playerHands]);

  // Fonction pour réinitialiser le jeu
  const resetGame = () => {
    console.log("Resetting game...");
    setDeck(data);
    setPlayerHands({});
    setDealerCards([]);
    setDealerScore(0);
    setDealerCount(0);
    setDealerTurnStarted(false);
    setPlayerResults({});
    setGameState(GameState.init);
  };

  // Réinitialisation des compteurs des joueurs via l'API
  const resetPlayerCounters = async () => {
    try {
      const resetPlayers = players.map((player) => ({
        uuid: player.uuid,
        team: player.team,
        hit: "0",
        stand: "0",
      }));

      console.log("Reset players:", resetPlayers);

      resetPlayers.forEach(async (player) => {
        console.log(player, "test");

        const response = await fetch(
          "http://localhost:8080/api/data",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(player),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to reset player counters");
        }
      });

      console.log("Players counters reset successfully");
    } catch (error) {
      console.error("Error resetting player counters:", error);
    }
  };

  // Fonction pour tirer une carte
  const drawCard = (dealType: Deal, playerId?: string) => {
    if (deck.length > 0) {
      const randomIndex = Math.floor(Math.random() * deck.length);
      const card = deck[randomIndex];
      deck.splice(randomIndex, 1);
      setDeck([...deck]);
      console.log("Drew card:", card, "for", dealType, playerId);

      switch (dealType) {
        case Deal.user:
          if (playerId) {
            setPlayerHands((prevHands) => ({
              ...prevHands,
              [playerId]: [...(prevHands[playerId] || []), card],
            }));
          }
          break;
        case Deal.dealer:
          dealerCards.push(card);
          setDealerCards([...dealerCards]);
          break;
        case Deal.hidden:
          dealerCards.push({ ...card, hidden: true });
          setDealerCards([...dealerCards]);
          break;
        default:
          break;
      }
    } else {
      alert("All cards have been drawn");
    }
  };

  // Fonction pour révéler les cartes cachées du dealer
  const revealCard = () => {
    console.log("Revealing hidden cards...");
    dealerCards.filter((card: any) => {
      if (card.hidden === true) {
        card.hidden = false;
      }
      return card;
    });
    setDealerCards([...dealerCards]);
  };

  // État pour les scores des joueurs
  const [playerScores, setPlayerScores] = useState<{ [key: string]: number }>(
    {}
  );

  // Fonction pour calculer le score d'une main
  const calculate = (cards: any[]): number => {
    let total = 0;
    cards.forEach((card: any) => {
      if (!card.hidden && card.value !== "A") {
        switch (card.value) {
          case "K":
          case "Q":
          case "J":
            total += 10;
            break;
          default:
            total += Number(card.value);
            break;
        }
      }
    });
    // Gestion spéciale des As (1 ou 11)
    const aces = cards.filter((card: any) => card.value === "A");
    aces.forEach(() => {
      total += total + 11 > 21 ? 1 : 11;
    });
    return total;
  };

  // Mise à jour des scores et détection automatique des "bust"
  useEffect(() => {
    const newScores: { [key: string]: number } = {};
    Object.entries(playerHands).forEach(([playerId, cards]) => {
      newScores[playerId] = calculate(cards);
    });
    setPlayerScores(newScores);

    // Mise à jour de la référence pour accès dans d'autres effets
    playerScoresRef.current = newScores;

    // Si un joueur dépasse 21, le marquer automatiquement comme "stand"
    players.forEach((player) => {
      const playerScore = newScores[player.uuid] || 0;
      if (playerScore >= 22 && player.stand !== "1") {
        console.log(`Player ${player.uuid} busts with score: ${playerScore}`);

        setPlayerResults((prevResults) => ({
          ...prevResults,
          [player.uuid]: Message.bust,
        }));

        // Mise à jour du "stand" à 1 via l'API
        fetch("http://localhost:8080/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uuid: player.uuid,
            team: player.team,
            hit: player.hit,
            stand: "1",
          }),
        })
          .then((response) => {
            if (!response.ok) throw new Error("Failed to update player stand");
            console.log(`Player ${player.uuid} stand set to 1`);
          })
          .catch((error) => {
            console.error("Error updating player stand:", error);
          });
      }
    });
  }, [playerHands, players]);

  // Fonction pour déterminer les gagnants à la fin du jeu
  const checkWin = () => {
    console.log("Checking win condition...");
    const newResults: { [key: string]: string } = {};

    Object.entries(playerHands).forEach(([playerId, hand]) => {
      const playerScore = playerScores[playerId] || 0;

      if (playerScore > 21) {
        newResults[playerId] = Message.bust;
      } else if (dealerScore > 21) {
        newResults[playerId] = Message.userWin;
      } else if (playerScore > dealerScore) {
        newResults[playerId] = Message.userWin;
      } else if (dealerScore > playerScore) {
        newResults[playerId] = Message.dealerWin;
      } else {
        newResults[playerId] = Message.tie;
      }
    });

    setPlayerResults(newResults);
  };

  // Composant pour afficher le résultat d'un joueur
  const PlayerResult: React.FC<{ message: string }> = ({ message }) => {
    return (
      <div
        className={styles.resultMessage}
        style={{
          marginTop: "10px",
          textAlign: "center",
          fontWeight: "bold",
          color:
            message === Message.userWin
              ? "green"
              : message === Message.dealerWin
              ? "red"
              : message === Message.bust
              ? "red"
              : "orange",
        }}
      >
        {message}
      </div>
    );
  };

  // Styles pour l'écran de démarrage
  const startScreenStyle: React.CSSProperties = {
    display: gameStarted ? "none" : "flex",
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  };

  const startButtonStyle: React.CSSProperties = {
    padding: "15px 30px",
    fontSize: "24px",
    fontWeight: "bold",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
  };

  const startButtonStyleDisabled: React.CSSProperties = {
    padding: "15px 30px",
    fontSize: "24px",
    fontWeight: "bold",
    backgroundColor: "#grey",
    color: "black",
    cursor: "not-allowed",
    border: "none",
    borderRadius: "5px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
  };

  const gameContentStyle: React.CSSProperties = {
    display: gameStarted ? "block" : "none",
  };

  // Rendu principal avec écran de démarrage et interface de jeu
  return (
  <>
    {/* Écran de démarrage */}
    <div style={startScreenStyle}>
      <button style={startButtonStyle} onClick={startGame}>
        BlackJack
      </button>
      <button style={startButtonStyleDisabled} disabled>
        Casino
      </button>
      <button style={startButtonStyleDisabled} disabled>
        Poker
      </button>
    </div>

    {/* Contenu du jeu */}
    <div style={gameContentStyle}>
      <div className="table">
        <div className="hand dealer">
          <Hand
            title={`Dealer's Hand (${dealerScore})`}
            cards={dealerCards}
          />
        </div>
        {players.map((player) => {
          // Déterminer la classe CSS en fonction de la couleur de l'équipe
          const positionClass = 
            player.team === "green" ? "player-0" : 
            player.team === "blue" ? "player-1" : 
            player.team === "yellow" ? "player-2" : 
            player.team === "red" ? "player-3" : "";
          
          return (
            <div key={player.uuid} className={`hand player ${positionClass}`}>
              <Hand
                title={`Player ${player.team}'s Hand (${
                  playerScores[player.uuid] || 0
                })`}
                cards={playerHands[player.uuid] || []}
              />
              {playerResults[player.uuid] && (
                <PlayerResult message={playerResults[player.uuid]} />
              )}
              <div className="player">
                <p>joueur {player.team}</p>
              </div>
            </div>
          );
        })}
        <div className="actions-top">
          <p>Tirer</p>
          <p>S'arrêter</p>
        </div>
        <div className="actions-right">
          <p>Tirer</p>
          <p>S'arrêter</p>
        </div>
        <div className="actions-bottom">
          <p>Tirer</p>
          <p>S'arrêter</p>
        </div>
        <div className="actions-left">
          <p>Tirer</p>
          <p>S'arrêter</p>
        </div>
      </div>
    </div>
  </>
  );
}

export default App;
