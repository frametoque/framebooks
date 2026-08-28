"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { MdKeyboardArrowDown, MdSearch, MdClose } from "react-icons/md";

interface Client {
  id: string | number;
  name: string;
  email: string;
}

interface ClientComboboxProps {
  name: string;
  value: string;
  onChange: (e: any) => void;
  clients: Client[];
  loading?: boolean;
}

export default function ClientCombobox({ name, value, onChange, clients, loading }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedClient = clients.find(c => String(c.id) === String(value));
  
  const filteredClients = useMemo(() => {
    const s = search.toLowerCase();
    return clients.filter(c => 
      (c.name || "").toLowerCase().includes(s) || 
      (c.email || "").toLowerCase().includes(s)
    );
  }, [clients, search]);

  const handleSelect = (val: string) => {
    onChange({ target: { name, value: val } });
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors flex justify-between items-center text-left"
      >
        <span className={value ? "text-foreground" : "text-gray-400"}>
          {loading ? "Loading clients..." : value === "new" ? "+ Create New Client" : selectedClient ? `${selectedClient.name} (${selectedClient.email})` : "Choose a client..."}
        </span>
        <MdKeyboardArrowDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 w-full mt-2 bg-[#0d0d12] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border flex items-center gap-2 px-3">
            <MdSearch className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="MdSearch by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-sm py-2 text-foreground"
            />
          </div>
          
          <div className="overflow-y-auto max-h-[240px]">
            <button
              type="button"
              onClick={() => handleSelect("new")}
              className="w-full text-left px-4 py-3 text-sm text-brand-400 hover:bg-black/10 dark:hover:bg-white/10 font-medium transition-colors"
            >
              + Create New Client
            </button>
            
            {filteredClients.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(String(c.id))}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-card transition-colors ${String(c.id) === String(value) ? 'bg-white/10 text-foreground' : 'text-gray-300'}`}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">{c.email}</div>
              </button>
            ))}
            
            {filteredClients.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No clients found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
