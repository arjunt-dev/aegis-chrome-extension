interface IconButtonProps {
  icon: React.ElementType;
  tooltip: string;
  onClick?: () => void;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  tooltip,
  onClick,
}) => {
  return (
    <div className="relative icon-btn-group">
      <button className="icon-btn" onClick={onClick}>
        <Icon className="w-6 h-6 text-gray-300" />
      </button>
      <span className="tooltip">{tooltip}</span>
    </div>
  );
};

export default IconButton;
