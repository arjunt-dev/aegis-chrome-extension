interface AlertBannerProps {
  type: "success" | "error" | "info"| "warning";
  message: string;
}

export default function AlertBanner({ type, message }: AlertBannerProps) {
  if (!message) return null;
  const alert_obj = {
    "success": {bg:"bg-green-600", text:"text-white"},
    "error": {bg:"bg-red-600", text:"text-white"},
    "info": {bg:"bg-blue-600", text:"text-white"},
    "warning": {bg:"bg-yellow-600", text:"text-black"}
  }
  return (
    <div
      className={`w-full p-3 rounded-lg text-sm mb-3 ${
        alert_obj[type].bg
      } ${alert_obj[type].text}`}
    >
      {message}
    </div>
  );
}
