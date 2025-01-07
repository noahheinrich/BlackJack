import React from 'react';
import styles from './styles/Card.module.css';

type CardProps = {
  value: string;
  suit: string;
  hidden: boolean;
};

const Card: React.FC<CardProps> = ({ value, suit, hidden }) => {
  // Map des noms des couleurs vers les symboles
  const suitSymbols: { [key: string]: string } = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣'
  };

  // Récupérer le symbole correspondant au "suit"
  const displaySuit = suitSymbols[suit];

  // Déterminer la couleur de la carte
  const getColor = () => (suit === 'spades' || suit === 'clubs' ? styles.black : styles.red);

  // Rendu de la carte
  const getCard = () => {
    if (hidden) {
      return <div className={styles.hiddenCard} />;
    } else {
      return (
        <div className={styles.card}>
          <div className={getColor()}>
            <h1 className={styles.value}>{value}</h1>
            <h1 className={styles.suit}>{displaySuit}</h1>
          </div>
        </div>
      );
    }
  };

  return <>{getCard()}</>;
};

export default Card;
