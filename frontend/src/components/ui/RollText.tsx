import React from 'react';

export interface RollTextProps {
  text: string;
  className?: string;
}

export const RollText: React.FC<RollTextProps> = ({ text, className = '' }) => {
  return (
    <span className={`RollText-module__root ${className}`}>
      <span className="RollText-module__label">{text}</span>
      <span className="RollText-module__track" aria-hidden="true">
        {text.split('').map((char, index) => (
          <span
            key={index}
            className="RollText-module__letter"
            data-letter={char}
            style={{ '--roll-delay': `${index * 18}ms` } as React.CSSProperties}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </span>
    </span>
  );
};

export default RollText;
