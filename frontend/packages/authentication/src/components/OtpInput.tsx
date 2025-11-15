import { useRef } from "react";

interface OtpInputProps {
  value: string[];
  onChange: (val: string[]) => void;
}

export default function OtpInput({ value, onChange }: OtpInputProps) {
  const refs = Array.from({ length: 6 }, () =>
    useRef<HTMLInputElement>(null)
  );

  const handleInput = (digit: string, index: number) => {
    const newOtp = [...value];
    newOtp[index] = digit;
    onChange(newOtp);

    if (digit && index < 5) refs[index + 1].current?.focus();
  };

  const handleKeyDown = (e: any, index: number) => {
    if (e.key === "Backspace") {
      if (value[index] === "" && index > 0) {
        refs[index - 1].current?.focus();
      }
    }
  };

  return (
    <div className="flex justify-center gap-3">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={refs[i]}
          maxLength={1}
          value={digit}
          onChange={(e) => handleInput(e.target.value.replace(/\D/, ""), i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className="w-10 h-12 glass text-center text-xl font-bold rounded-lg"
        />
      ))}
    </div>
  );
}
