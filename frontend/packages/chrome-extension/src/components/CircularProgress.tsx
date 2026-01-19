import React, { useState, useEffect } from "react";

interface CircularProgressProps {
  value: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ value }) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  useEffect(() => {
    const duration = 1500; // Animation duration in milliseconds
    const frameRate = 60; // Frames per second
    const totalFrames = (duration / 1000) * frameRate;
    const increment = value / totalFrames;
    let currentFrame = 0;

    const timer = setInterval(() => {
      currentFrame++;
      if (currentFrame <= totalFrames) {
        setAnimatedValue(Math.min(value, currentFrame * increment));
      } else {
        setAnimatedValue(value);
        clearInterval(timer);
      }
    }, 1000 / frameRate);

    return () => clearInterval(timer);
  }, [value]);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedValue / 100) * circumference;

  return (
    <div className="circular-wrapper">
      <svg width="160" height="160" className="transform -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke="#14b8a6"
          strokeWidth="12"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          strokeLinecap="round"
        />
      </svg>

      <div className="absolute text-3xl font-semibold text-white">
        {animatedValue.toFixed(2)}%
      </div>
    </div>
  );
};

export default CircularProgress;
