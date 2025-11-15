import React from "react";

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={disabled ? "text-gray-500" : ""}>{label}</span>

      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />

        <div
          className={`
            w-11 h-6 rounded-full transition
            ${disabled ? "bg-gray-700" : "bg-gray-600 peer-checked:bg-teal-500"}
            peer
            after:content-[''] after:absolute after:top-0.5 after:left-0.5
            after:w-5 after:h-5 after:bg-white after:rounded-full
            after:transition-all
            peer-checked:after:translate-x-5
          `}
        ></div>
      </label>
    </div>
  );
};

export default ToggleSwitch;
