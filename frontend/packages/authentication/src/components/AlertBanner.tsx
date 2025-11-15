interface AlertBannerProps {
  type: "success" | "error";
  message: string;
}

export default function AlertBanner({ type, message }: AlertBannerProps) {
  return (
    <div
      className={`w-full p-3 rounded-lg text-sm mb-3 ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      } text-white`}
    >
      {message}
    </div>
  );
}
