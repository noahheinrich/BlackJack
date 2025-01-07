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

  const [players, setPlayers] = useState<{ uuid: string, team: string }[]>([]);
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

  // const socket = io('http://your-socket-server-url');

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        console.log('Fetching players...');
        const response = await fetch('/api/data');
        const textResponse = await response.text();
        console.log('Raw response:', textResponse);
        const newPlayers = JSON.parse(textResponse) as { uuid: string; team: string }[];
        console.log('Players fetched:', newPlayers);
        
        const teamMap = new Map<string, { uuid: string; team: string }>();
        newPlayers.forEach((player) => {
          if (!teamMap.has(player.team)) {
            teamMap.set(player.team, player);
          }
        });

        setPlayers(Array.from(teamMap.values()));

        // const uniqueTeams = Array.from(new Set(newPlayers.map((p) => p.team)));
        // setPlayers(uniqueTeams.map((team) => ({ uuid: team, team })));
        // console.log('Unique teams:', uniqueTeams);
        // setPlayers(newPlayers);
      } catch (error) {
        console.error('Error fetching players:', error);
      }
    };


    fetchPlayers();
    const interval = setInterval(fetchPlayers, 50000); // Mise à jour toutes les 5 secondes

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
    calculate(dealerCards, setDealerScore);
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
  }

  const placeBet = (amount: number) => {
    console.log('Placing bet:', amount);
    setBet(amount);
    setBalance(Math.round((balance - amount) * 100) / 100);
    setGameState(GameState.init);
  }

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
            const newHand = playerHands[playerId] || [];
            newHand.push(card);
            setPlayerHands({ ...playerHands, [playerId]: newHand });
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
  }

  const revealCard = () => {
    console.log('Revealing hidden cards...');
    dealerCards.filter((card: any) => {
      if (card.hidden === true) {
        card.hidden = false;
      }
      return card;
    });
    setDealerCards([...dealerCards]);
  }

  const calculate = (cards: any[], setScore: (score: number) => void) => {
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
    console.log('Calculated score:', total);
    setScore(total);
  }

  const hit = (playerId: string) => {
    console.log('Player hits:', playerId);
    drawCard(Deal.user, playerId);
  }

  const stand = () => {
    console.log('Player stands');
    setButtonState({
      hitDisabled: true,
      standDisabled: true,
      resetDisabled: false
    });
    setGameState(GameState.dealerTurn);
    revealCard();
  }

  const checkWin = () => {
    console.log('Checking win condition...');
    const playerScores = Object.values(playerHands).map((hand: any[]) => {
      let score = 0;
      calculate(hand, (s: number) => score = s);
      return score;
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
  }
  
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
          <Hand title={`Dealer's Hand (${dealerScore})`} cards={dealerCards} />
        </div>
        {players.map((player, index) => (
          console.log('Rendering player:', player),
          console.log('Player hands:', playerHands),
          <div key={player.uuid} className={`hand player player-${index}`}>
            <Hand title={`Player ${player.team}'s Hand`} cards={playerHands[player.uuid] || []} />
          </div>
        ))}
      </div>
    </>
  );
}

export default App;
