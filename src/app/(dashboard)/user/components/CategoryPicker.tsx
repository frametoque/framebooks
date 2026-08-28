"use client";
import { Loader } from "@/components/ui/Loader";


import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { MdKeyboardArrowDown, MdClose, MdDelete, MdAdd } from "react-icons/md";
import { getCategories, createCategory, deleteCategory } from "../actions/categories";
import { useConfirm } from '@/components/ui/ConfirmProvider';

interface CategoryPickerProps {
  value: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  // Kept for backward compatibility, but we fetch our own now
  categories?: string[];
}

export default function CategoryPicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Select categories...",
  categories: initialCategories = [],
}: CategoryPickerProps) {
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [serverCategories, setServerCategories] = useState<string[]>(initialCategories);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch categories on mount
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await getCategories();
        setServerCategories(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(serverCategories.length * 44 + 80, 400);

    if (spaceBelow >= dropdownHeight) {
      setDropdownStyle({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    } else {
      setDropdownStyle({
        top: rect.top + window.scrollY - dropdownHeight - 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open]);

  const toggle = (cat: string) => {
    onChange(value.includes(cat) ? value.filter((c) => c !== cat) : [...value, cat]);
  };

  const removeValue = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((c) => c !== cat));
  };

  const handleAddCategory = async (catName: string) => {
    if (!catName || serverCategories.includes(catName)) return;
    try {
      setAdding(true);
      await createCategory(catName);
      setServerCategories(prev => [...prev, catName].sort());
      onChange([...value, catName]);
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCategory = async (catName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!await confirm(`Delete category "${catName}"?`)) return;
    try {
      await deleteCategory(catName);
      setServerCategories(prev => prev.filter(c => c !== catName));
      onChange(value.filter(c => c !== catName));
    } catch (e) {
      console.error(e);
    }
  };

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={{ ...dropdownStyle, position: "absolute", zIndex: 9999 }}
      className="bg-[#0d0d12] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[400px]"
    >
      <div className="p-2 border-b border-border flex gap-2 shrink-0">
        <input
          type="text"
          placeholder="New category..."
          disabled={adding}
          className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 text-foreground disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const val = e.currentTarget.value.trim();
              if (val) {
                handleAddCategory(val);
                e.currentTarget.value = "";
              }
            }
          }}
        />
        <button
          type="button"
          disabled={adding}
          onClick={(e) => {
            e.preventDefault();
            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
            const val = input.value.trim();
            if (val) {
              handleAddCategory(val);
              input.value = "";
            }
          }}
          className="px-3 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[60px]"
        >
          {adding ? <Loader size="sm" /> : "Add"}
        </button>
      </div>
      
      <div className="overflow-y-auto flex-1 py-1">
        {loading ? (
          <div className="p-4 flex justify-center"><Loader size="sm" /></div>
        ) : serverCategories.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">No categories found</div>
        ) : (
          serverCategories.map((cat) => {
            const selected = value.includes(cat);
            return (
              <div
                key={cat}
                className={`group w-full px-4 py-2 text-sm flex items-center justify-between transition-colors hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
                  selected ? "text-brand-300" : "text-gray-300"
                }`}
                onClick={() => toggle(cat)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected ? "bg-brand-500 border-brand-500" : "border-white/25 bg-card"
                    }`}
                  >
                    {selected && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {cat}
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteCategory(cat, e)}
                  className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-red-400/10"
                >
                  <MdDelete className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="w-full h-[42px] bg-transparent border border-border rounded-xl px-3 py-2 outline-none focus:border-brand-500 transition-colors disabled:opacity-50 flex items-center gap-2 text-left overflow-hidden"
      >
        {value.length === 0 ? (
          <span className="text-gray-500 text-sm flex-1 truncate">{placeholder}</span>
        ) : (
          <span className="flex-1 flex items-center gap-1.5 overflow-hidden">
            {value.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-medium whitespace-nowrap"
              >
                {cat}
                {!disabled && (
                  <MdClose className="w-3 h-3 cursor-pointer hover:text-foreground flex-shrink-0" onClick={(e) => removeValue(cat, e)} />
                )}
              </span>
            ))}
            {value.length > 2 && (
              <span className="text-xs text-gray-400 whitespace-nowrap">+{value.length - 2} more</span>
            )}
          </span>
        )}
        <MdKeyboardArrowDown
          className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </>
  );
}
