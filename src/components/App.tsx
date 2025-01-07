import React, { useState, useEffect } from 'react';
import Status from './Status';
import Controls from './Controls';
import Hand from './Hand';
import jsonData from '../deck.json';
import './styles/App.css';

const App: React.FC = () => {
  enum GameState {
    bet,
    init,
    userTurn,
    dealerTurn
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

  const [balance, setBalance] = useState(100);
  const [bet, setBet] = useState(0);

  const [gameState, setGameState] = useState(GameState.bet);
  const [message, setMessage] = useState(Message.bet);
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
        console.log('Dealing cards to player:', player);
        drawCard(Deal.user, player.uuid);
        drawCard(Deal.user, player.uuid);
      });
      setGameState(GameState.userTurn);
      setMessage(Message.hitStand);
    }
  }, [gameState, players]);

  useEffect(() => {
    console.log('Dealer cards updated:', dealerCards);
    const score = calculate(dealerCards);
    setDealerScore(score);
    setDealerCount(dealerCount + 1);
  }, [dealerCards]);

  useEffect(() => {
    console.log('Dealer count updated:', dealerCount);
    if (gameState === GameState.dealerTurn) {
      if (dealerScore >= 17) {
        checkWin();
      } else {
        drawCard(Deal.dealer);
      }
    }
  }, [dealerCount]);

  // Gestion des actions "Hit" et "Stand" des joueurs
  useEffect(() => {
    players.forEach((player) => {
      const playerId = player.uuid;

      // Gestion du "Hit" : ajouter une carte si nécessaire
      if (parseInt(player.hit) > ((playerHands[playerId] ? playerHands[playerId].length : 0)) && player.stand !== "1") {
        console.log(`Player ${playerId} hits.`);
        drawCard(Deal.user, playerId);
      }

      // Gestion du "Stand" : vérifier si le joueur a décidé de se coucher
      if (player.stand === "1") {
        console.log(`Player ${playerId} stands.`);
        // Ajouter toute logique spécifique pour "stand" ici (si besoin)
      }
    });
  }, [players, playerHands]);

  const resetGame = () => {
    console.clear();
    console.log('Resetting game...');
    setDeck(data);
    setPlayerHands({});
    setDealerCards([]);
    setDealerScore(0);
    setDealerCount(0);
    setBet(0);
    setGameState(GameState.bet);
    setMessage(Message.bet);
    setButtonState({
      hitDisabled: false,
      standDisabled: false,
      resetDisabled: true
    });
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
  }, [playerHands]);


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
    const playerScores = Object.values(playerHands).map((hand: any[]) => {
      return calculate(hand);
    });
    const maxPlayerScore = Math.max(...playerScores);

    if (maxPlayerScore > dealerScore || dealerScore > 21) {
      setBalance(Math.round((balance + (bet * 2)) * 100) / 100);
      setMessage(Message.userWin);
    } else if (dealerScore > maxPlayerScore) {
      setMessage(Message.dealerWin);
    } else {
      setBalance(Math.round((balance + (bet * 1)) * 100) / 100);
      setMessage(Message.tie);
    }
  };

  return (
    <>
      <Status message={message} balance={balance} />
      <Controls
        balance={balance}
        gameState={gameState}
        buttonState={buttonState}
        betEvent={placeBet}
        hitEvent={(playerId: string) => hit(playerId)}
        standEvent={stand}
        resetEvent={resetGame}
      />
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
          </div>
        ))}
      </div>
    </>
  );
};

export default App;
