import React, { useState, useEffect } from 'react';
// import Status from './Status';
// import Controls from './Controls';
import Hand from './Hand';
import jsonData from '../deck.json';
import './styles/App.css';
import styles from './styles/Status.module.css';

const App: React.FC = () => {
  enum GameState {
    // bet,
    init,
    userTurn,
    dealerTurn,
    gameEnd
  }

  enum Deal {
    user,
    dealer,
    hidden
  }

  enum Message {
    bet = 'Place a Bet!',
    hitStand = 'Hit or Stand?',
    bust = 'Bust!',
    userWin = 'You Win!',
    dealerWin = 'Dealer Wins!',
    tie = 'Tie!'
  }

  const data = JSON.parse(JSON.stringify(jsonData.cards));
  const [deck, setDeck]: any[] = useState(data);

  const [players, setPlayers] = useState<{ uuid: string; team: string; hit: string; stand: string }[]>([]);
  const [playerHands, setPlayerHands] = useState<{ [key: string]: any[] }>({});
  const [dealerCards, setDealerCards]: any[] = useState([]);
  const [dealerScore, setDealerScore] = useState(0);
  const [dealerCount, setDealerCount] = useState(0);
  const [dealerTurnStarted, setDealerTurnStarted] = useState(false);

  const [playerResults, setPlayerResults] = useState<{ [key: string]: string }>({});
  const [previousHits, setPreviousHits] = useState<{ [key: string]: number }>({});
  const [previousPlayers, setPreviousPlayers] = useState<{ [key: string]: boolean }>({});
  const playerScoresRef = React.useRef<{ [key: string]: number }>({});

  const [balance, setBalance] = useState(100);
  const [bet, setBet] = useState(0);

  const [gameState, setGameState] = useState(GameState.init);
  // const [message, setMessage] = useState('');
  const [buttonState, setButtonState] = useState({
    hitDisabled: false,
    standDisabled: false,
    resetDisabled: true
  });

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        console.log('Fetching players...');
        const response = await fetch('/api/data');
        const textResponse = await response.text();
        console.log('Raw response:', textResponse);
        const newPlayers = JSON.parse(textResponse) as { uuid: string; team: string; hit: string; stand: string }[];
        console.log('Players fetched:', newPlayers);

        const teamMap = new Map<string, { uuid: string; team: string; hit: string; stand: string }>();
        newPlayers.forEach((player) => {
          if (!teamMap.has(player.team)) {
            teamMap.set(player.team, player);
          }
        });

        setPlayers(Array.from(teamMap.values()));
      } catch (error) {
        console.error('Error fetching players:', error);
      }
    };

    fetchPlayers();
    const interval = setInterval(fetchPlayers, 5000); // Mise à jour toutes les 5 secondes

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log('Game state changed:', gameState);
    if (gameState === GameState.init) {
      drawCard(Deal.dealer);
      players.forEach(player => {
        drawCard(Deal.user, player.uuid);
        drawCard(Deal.user, player.uuid);
      });
      setGameState(GameState.userTurn);
    }
  }, [gameState]);

  useEffect(() => {
    const allPlayersStand = players.every(player => player.stand === "1");
    if (allPlayersStand && gameState === GameState.userTurn && !dealerTurnStarted) {
      setDealerTurnStarted(true);
      setGameState(GameState.dealerTurn);
      revealCard();
    }
  }, [players, gameState]);

  useEffect(() => {
    console.log('Dealer cards updated:', dealerCards);
    const score = calculate(dealerCards);
    setDealerScore(score);
    setDealerCount(dealerCount + 1);
  }, [dealerCards]);

  useEffect(() => {
    if (gameState === GameState.dealerTurn) {
      if (dealerScore >= 17) {
        checkWin();
        setGameState(GameState.gameEnd);
        // Attendre 7 secondes puis redémarrer
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
      const playerScore = playerScoresRef.current[playerId] || 0; // Utilisation de la référence

      // Vérifier si le joueur a dépassé 21 pour empêcher tout ajout de carte
      if (playerScore <= 21 && currentHit > previousHit && player.stand !== "1") {
        console.log(`Player ${playerId} hits with score: ${playerScore}`);
        drawCard(Deal.user, playerId);

        // Mettre à jour le nombre de hits précédents
        setPreviousHits((prev) => ({
          ...prev,
          [playerId]: currentHit
        }));
      }

      if (!previousPlayers[playerId]) {
        console.log(`New player detected: ${playerId}`);

        // Initialiser la main du nouveau joueur avec deux cartes
        drawCard(Deal.user, playerId);
        drawCard(Deal.user, playerId);
      }

      newPlayers[playerId] = true;
    });

    setPreviousPlayers(newPlayers);
  }, [players, playerHands]);


  const resetGame = () => {
    // console.clear();
    console.log('Resetting game...');
    setDeck(data);
    setPlayerHands({});
    setDealerCards([]);
    setDealerScore(0);
    setDealerCount(0);
    setDealerTurnStarted(false);
    setPlayerResults({});
    setGameState(GameState.init);
  };

  const resetPlayerCounters = async () => {
    try {
      // Création d'un tableau avec les données mises à jour dans le bon ordre
      const resetPlayers = players.map(player => ({
        uuid: player.uuid,
        team: player.team,
        hit: "0",
        stand: "0"
      }));

      console.log('Reset players:', resetPlayers);

      resetPlayers.forEach(async (player) => {

        console.log(player, "test");

        const response = await fetch('http://www.api-table.jocelynmarcilloux.com/api/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(player)
        });

        if (!response.ok) {
          throw new Error('Failed to reset player counters');
        }
      });

      console.log('Players counters reset successfully');
    } catch (error) {
      console.error('Error resetting player counters:', error);
    }
  };


  const placeBet = (amount: number) => {
    console.log('Placing bet:', amount);
    setBet(amount);
    setBalance(Math.round((balance - amount) * 100) / 100);
    setGameState(GameState.init);
  };

  const drawCard = (dealType: Deal, playerId?: string) => {
    if (deck.length > 0) {
      const randomIndex = Math.floor(Math.random() * deck.length);
      const card = deck[randomIndex];
      deck.splice(randomIndex, 1);
      setDeck([...deck]);
      console.log('Drew card:', card, 'for', dealType, playerId);

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
      alert('All cards have been drawn');
    }
  };

  const revealCard = () => {
    console.log('Revealing hidden cards...');
    dealerCards.filter((card: any) => {
      if (card.hidden === true) {
        card.hidden = false;
      }
      return card;
    });
    setDealerCards([...dealerCards]);
  };

  // Ajoutez un state pour gérer les scores des joueurs
  const [playerScores, setPlayerScores] = useState<{ [key: string]: number }>({});

  // Modifiez la fonction calculate pour qu'elle retourne le score
  const calculate = (cards: any[]): number => {
    let total = 0;
    cards.forEach((card: any) => {
      if (!card.hidden && card.value !== 'A') {
        switch (card.value) {
          case 'K':
          case 'Q':
          case 'J':
            total += 10;
            break;
          default:
            total += Number(card.value);
            break;
        }
      }
    });
    const aces = cards.filter((card: any) => card.value === 'A');
    aces.forEach(() => {
      total += (total + 11 > 21) ? 1 : 11;
    });
    return total;
  };

  useEffect(() => {
    const newScores: { [key: string]: number } = {};
    Object.entries(playerHands).forEach(([playerId, cards]) => {
      newScores[playerId] = calculate(cards);
    });
    setPlayerScores(newScores);
    
    // Mettre à jour la référence avec les nouveaux scores
    playerScoresRef.current = newScores;

    // Vérification si un joueur dépasse 21 et mise à jour automatique de "stand"
    players.forEach((player) => {
      const playerScore = newScores[player.uuid] || 0;
      if (playerScore >= 22 && player.stand !== "1") {
        console.log(`Player ${player.uuid} busts with score: ${playerScore}`);

        // Mettre à jour les résultats du joueur avec le message "Bust!"
        setPlayerResults((prevResults) => ({
          ...prevResults,
          [player.uuid]: Message.bust
        }));

        // Envoyer la mise à jour de "stand" à l'API
        fetch('http://www.api-table.jocelynmarcilloux.com/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uuid: player.uuid,
            team: player.team,
            hit: player.hit,
            stand: "1"
          })
        })
          .then((response) => {
            if (!response.ok) throw new Error('Failed to update player stand');
            console.log(`Player ${player.uuid} stand set to 1`);
          })
          .catch((error) => {
            console.error('Error updating player stand:', error);
          });
      }
    });
  }, [playerHands, players]);



  const hit = (playerId: string) => {
    console.log('Player hits:', playerId);
    drawCard(Deal.user, playerId);
  };

  const stand = () => {
    console.log('Player stands');
    setButtonState({
      hitDisabled: true,
      standDisabled: true,
      resetDisabled: false
    });
    setGameState(GameState.dealerTurn);
    revealCard();
  };

  const checkWin = () => {
    console.log('Checking win condition...');
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

  const PlayerResult: React.FC<{ message: string }> = ({ message }) => {
    return (
      <div className={styles.resultMessage} style={{
        marginTop: '10px',
        textAlign: 'center',
        fontWeight: 'bold',
        color: message === Message.userWin ? 'green' : 
              message === Message.dealerWin ? 'red' : 
              message === Message.bust ? 'red' : 'orange'
      }}>
        {message}
      </div>
    );
  };

  return (
    <>
      <div className="table">
        <div className="hand dealer">
          <Hand 
            title={`Dealer's Hand (${dealerScore})`} 
            cards={dealerCards} 
          />
        </div>
        {players.map((player, index) => (
          <div key={player.uuid} className={`hand player player-${index}`}>
            <Hand 
              title={`Player ${player.team}'s Hand (${playerScores[player.uuid] || 0})`} 
              cards={playerHands[player.uuid] || []} 
            />
            {playerResults[player.uuid] && (
              <PlayerResult message={playerResults[player.uuid]} />
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export default App;
