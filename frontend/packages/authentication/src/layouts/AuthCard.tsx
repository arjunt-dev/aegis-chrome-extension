import { Outlet } from "react-router";

export default function AuthCard({ title="Aegis" }: { title?: string;}) {
  return (
   <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div
        className="
          glass 
          w-full 
          max-w-lg 
          min-h-[420px] 
          p-8 
          rounded-2xl 
          shadow-xl 
          flex flex-col 
          items-center 
        "
      >
        <div className="w-24 h-24 rounded-full bg-gray-700/40 mb-4 flex items-center justify-center">
          <img
            src="/logo.pn"
            alt="logo"
            className="w-20 h-20 object-contain opacity-80"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none"; 
            }}
          />
        </div>
        <h1 className="text-2xl font-semibold text-gray-100 mb-6 text-center">
          {title}
        </h1>
        <Outlet />
      </div>
    </div>
  );
}
