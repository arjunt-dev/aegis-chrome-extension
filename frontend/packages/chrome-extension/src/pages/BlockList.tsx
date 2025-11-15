import { useEffect, useState } from "react";
import { getBlocklist, type BlockItem } from "../utils/utils";
import { Trash2, ShieldAlert } from "lucide-react";

export default function BlockList() {
  const [list, setList] = useState<BlockItem[]>([]);

  useEffect(() => {
    (async () => {
      const data = await getBlocklist();
      setList(data);
    })();
  }, []);

  return (
    <div className="min-h-screen w-full bg-primary text-gray-200 px-4 py-6">
      <h1 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <ShieldAlert className="w-6 h-6 text-red-400" /> Blocked URLs
      </h1>

      <ul className="glass rounded-xl p-4">
        {list.map((item, index) => (
          <li
            key={index}
            className="flex justify-between items-center py-3 border-b border-gray-700 last:border-0"
          >
            <span className="text-sm md:text-base">{item.url}</span>

            {item.blocked ? (
              <button className="btn-red px-3 py-1 rounded-lg text-sm">
                Unblock
              </button>
            ) : (
              <button className="btn-teal px-3 py-1 rounded-lg text-sm">
                Block
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
