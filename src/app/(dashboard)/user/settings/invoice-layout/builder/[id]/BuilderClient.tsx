// src/app/(dashboard)/user/settings/invoice-layout/builder/[id]/BuilderClient.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, RotateCcw, Eye, ZoomIn, ZoomOut, Check, AlertCircle,
  Trash2, ArrowUp, ArrowDown, Layout, Type, Palette, Sliders, Lock, Sparkles, Plus, Layers,
  Undo2, Redo2, Upload, Image as ImageIcon, FileText, SlidersHorizontal, AlignLeft,
  AlignCenter, AlignRight, DollarSign, Table, Calculator, CreditCard, FileCheck, PenTool,
  Minus, Maximize2, X, Move, Copy, Calendar, Hash, Percent, Clock, Tag, User,
  MapPin, Mail, Phone, Globe, Landmark, Building, Scissors, Bold, Italic
} from "lucide-react";
import {
  InvoiceLayoutDefinition, LayoutBlock, BlockType, SectionRow, SectionColumn, BlockStyle,
  CustomFieldDefinition, LayoutDocumentType
} from "@/lib/invoice-layout/types";
import { STANDARD_LAYOUT_DEFINITION, MODERN_MINIMAL_DEFINITION } from "@/lib/invoice-layout/templates";
import { SAMPLE_INVOICE_DATA, SAMPLE_TENANT_INFO } from "@/lib/invoice-layout/sample-data";
import { InvoiceRenderer } from "@/lib/invoice-layout/renderer";
import { saveInvoiceLayout, getCustomFields, uploadInvoiceLayoutAsset } from "../../../../actions/invoice-layouts";
import { validateCompulsoryBlocks } from "@/lib/invoice-layout/compulsory-validator";

interface BuilderClientProps {
  initialLayout?: any;
  layoutId: string;
}

const PALETTE_BLOCKS: {
  type: BlockType;
  name: string;
  icon: any;
  category: "Separate Fields" | "Separate Client" | "Separate Totals" | "Table" | "Brand" | "Custom" | "Payment" | "Extra";
}[] = [
    // 1. Separate Metadata Fields
    { type: "invoice_number", name: "Invoice / QT No.", icon: Hash, category: "Separate Fields" },
    { type: "invoice_date", name: "Invoice Date", icon: Calendar, category: "Separate Fields" },
    { type: "due_date", name: "Due Date", icon: Clock, category: "Separate Fields" },
    { type: "document_title", name: "Document Title", icon: Type, category: "Separate Fields" },

    // 2. Separate Client & Billing
    { type: "client_header", name: "Bill-To Title", icon: Type, category: "Separate Client" },
    { type: "client_name", name: "Client Name", icon: User, category: "Separate Client" },
    { type: "client_address", name: "Billing Address", icon: MapPin, category: "Separate Client" },
    { type: "client_email", name: "Client Email", icon: Mail, category: "Separate Client" },
    { type: "client_phone", name: "Client Phone", icon: Phone, category: "Separate Client" },

    // 3. Separate Totals & Amounts
    { type: "total_subtotal", name: "Subtotal", icon: DollarSign, category: "Separate Totals" },
    { type: "total_discount", name: "Discount", icon: Tag, category: "Separate Totals" },
    { type: "total_tax", name: "Tax Amount", icon: Percent, category: "Separate Totals" },
    { type: "total_advance", name: "Advance Paid", icon: CreditCard, category: "Separate Totals" },
    { type: "total_invoice", name: "Total Amount", icon: Calculator, category: "Separate Totals" },
    { type: "total_due", name: "Balance Due", icon: DollarSign, category: "Separate Totals" },

    // 4. Line Items Table & Separate Columns
    { type: "items_table", name: "Items Table (Group)", icon: Table, category: "Table" },
    { type: "items_col_desc", name: "Line Name (Description)", icon: FileText, category: "Table" },
    { type: "items_col_qty", name: "Quantity", icon: Hash, category: "Table" },
    { type: "items_col_price", name: "Unit Price", icon: DollarSign, category: "Table" },
    { type: "items_col_amount", name: "Line Item Amount", icon: DollarSign, category: "Table" },

    // 5. Brand & Business
    { type: "logo", name: "Business Logo", icon: ImageIcon, category: "Brand" },
    { type: "business_header", name: "Business Name", icon: Type, category: "Brand" },
    { type: "business_address", name: "Business Address", icon: MapPin, category: "Brand" },
    { type: "business_phone", name: "Business Phone", icon: Phone, category: "Brand" },
    { type: "business_email", name: "Business Email", icon: Mail, category: "Brand" },
    { type: "business_website", name: "Business Website", icon: Globe, category: "Brand" },

    // 6. Payment & Bank
    { type: "bank_name", name: "Bank Name", icon: Landmark, category: "Payment" },
    { type: "bank_acc_name", name: "Account Name", icon: User, category: "Payment" },
    { type: "bank_acc_number", name: "Account Number", icon: CreditCard, category: "Payment" },
    { type: "bank_branch", name: "Branch", icon: Building, category: "Payment" },
    { type: "notes", name: "Notes", icon: AlignLeft, category: "Payment" },
    { type: "terms", name: "Terms & Conditions", icon: FileCheck, category: "Payment" },

    // 7. Custom user blocks
    { type: "text_block", name: "Custom Text Block", icon: Type, category: "Custom" },
    { type: "image_block", name: "Custom Image / Stamp", icon: ImageIcon, category: "Custom" },
    { type: "custom_field", name: "Custom Field", icon: SlidersHorizontal, category: "Custom" },
    { type: "signature", name: "Signature Line", icon: PenTool, category: "Custom" },

    // 8. Extra Layout Helpers
    { type: "divider", name: "Divider Line", icon: Minus, category: "Extra" },
    { type: "spacer", name: "Spacer Gap", icon: Maximize2, category: "Extra" },
  ];

export default function BuilderClient({ initialLayout, layoutId }: BuilderClientProps) {
  const router = useRouter();
  const isNew = layoutId === "new";

  const [layoutName, setLayoutName] = useState(initialLayout?.name || "My Custom Layout");
  const [documentType, setDocumentType] = useState<LayoutDocumentType>(
    (initialLayout?.document_type as LayoutDocumentType) || "both"
  );
  const initialDef = initialLayout?.definition || STANDARD_LAYOUT_DEFINITION;
  const [definition, setDefinition] = useState<InvoiceLayoutDefinition>(() =>
    JSON.parse(JSON.stringify(initialDef))
  );
  const [isDefault, setIsDefault] = useState(Boolean(initialLayout?.is_default));
  const [scale, setScale] = useState(0.8);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<"block" | "document">("document");
  const [availableCustomFields, setAvailableCustomFields] = useState<CustomFieldDefinition[]>([]);

  // History Stack for Undo / Redo (deep-cloned snapshots to guarantee immutability)
  const [history, setHistory] = useState<InvoiceLayoutDefinition[]>(() => [
    JSON.parse(JSON.stringify(initialDef)),
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const historyRef = useRef<InvoiceLayoutDefinition[]>([
    JSON.parse(JSON.stringify(initialDef)),
  ]);
  const historyIndexRef = useRef<number>(0);

  // Keep refs in sync with state
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const blockImageInputRef = useRef<HTMLInputElement>(null);

  // Load tenant's custom fields so user can select them
  useEffect(() => {
    getCustomFields()
      .then((fields) => setAvailableCustomFields(fields || []))
      .catch(() => { });
  }, []);

  // Update definition with undo/redo history tracking
  const updateDefinitionWithHistory = useCallback((newDef: InvoiceLayoutDefinition) => {
    const cloned = JSON.parse(JSON.stringify(newDef));
    setDefinition(cloned);

    const currIdx = historyIndexRef.current;
    const currentHist = historyRef.current;
    const trimmed = currentHist.slice(0, currIdx + 1);
    const nextStack = [...trimmed, cloned];
    if (nextStack.length > 50) {
      nextStack.shift();
    }
    const nextIdx = nextStack.length - 1;

    historyRef.current = nextStack;
    historyIndexRef.current = nextIdx;
    setHistory(nextStack);
    setHistoryIndex(nextIdx);
  }, []);

  const handleUndo = useCallback(() => {
    const currIdx = historyIndexRef.current;
    if (currIdx > 0) {
      const prevIdx = currIdx - 1;
      historyIndexRef.current = prevIdx;
      setHistoryIndex(prevIdx);
      const snapshot = JSON.parse(JSON.stringify(historyRef.current[prevIdx]));
      setDefinition(snapshot);
    }
  }, []);

  const handleRedo = useCallback(() => {
    const currIdx = historyIndexRef.current;
    if (currIdx < historyRef.current.length - 1) {
      const nextIdx = currIdx + 1;
      historyIndexRef.current = nextIdx;
      setHistoryIndex(nextIdx);
      const snapshot = JSON.parse(JSON.stringify(historyRef.current[nextIdx]));
      setDefinition(snapshot);
    }
  }, []);

  const definitionRef = useRef(definition);
  useEffect(() => {
    definitionRef.current = definition;
  }, [definition]);

  const selectedBlockIdRef = useRef(selectedBlockId);
  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId;
  }, [selectedBlockId]);

  const handleDeleteBlockRef = useRef<(id: string) => void>(() => {});

  // Nudge block position by 1mm (or custom step) via arrow keys
  const handleNudgeBlock = useCallback((dx: number, dy: number) => {
    const activeBlockId = selectedBlockIdRef.current;
    if (!activeBlockId) return;
    const currentDef = definitionRef.current;

    let rIdx = -1;
    let cIdx = -1;
    let bIdx = -1;
    let currBlock: LayoutBlock | null = null;

    currentDef.sections.forEach((sec, r) => {
      sec.columns.forEach((col, c) => {
        col.blocks.forEach((b, bI) => {
          if (b.id === activeBlockId) {
            rIdx = r;
            cIdx = c;
            bIdx = bI;
            currBlock = b;
          }
        });
      });
    });

    if (!currBlock || rIdx < 0 || cIdx < 0 || bIdx < 0) return;

    const isLetter = currentDef.pageSize === "Letter";
    const paperWidth = isLetter ? 215.9 : 210;
    const paperHeight = isLetter ? 279.4 : 297;

    const currX = (currBlock as LayoutBlock).x ?? 15;
    const currY = (currBlock as LayoutBlock).y ?? 20;
    const blockW = (currBlock as LayoutBlock).width ?? 80;

    const newX = Math.round(Math.max(0, Math.min(paperWidth - blockW, currX + dx)) * 10) / 10;
    const newY = Math.round(Math.max(0, Math.min(paperHeight - 10, currY + dy)) * 10) / 10;

    const newSections = currentDef.sections.map((sec, r) => {
      if (r !== rIdx) return sec;
      return {
        ...sec,
        columns: sec.columns.map((col, c) => {
          if (c !== cIdx) return col;
          return {
            ...col,
            blocks: col.blocks.map((b, bI) => {
              if (bI !== bIdx) return b;
              return { ...b, x: newX, y: newY };
            }),
          };
        }),
      };
    });

    const nextDef = { ...currentDef, sections: newSections };
    definitionRef.current = nextDef;
    updateDefinitionWithHistory(nextDef);
  }, [updateDefinitionWithHistory]);

  // Keyboard shortcut listener for Arrow keys (0.1mm precision nudge, Shift for 1mm) & Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextEntry =
        target &&
        (target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" &&
            ["text", "search", "password", "email", "url", "number"].includes(
              (target as HTMLInputElement).type || "text"
            )) ||
          target.isContentEditable);

      // Handle Arrow keys for moving selected block by 0.1mm (Shift for 1mm)
      if (selectedBlockIdRef.current && !isTextEntry) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 0.1;
          handleNudgeBlock(-step, 0);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 0.1;
          handleNudgeBlock(step, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 0.1;
          handleNudgeBlock(0, -step);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 0.1;
          handleNudgeBlock(0, step);
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          handleDeleteBlockRef.current(selectedBlockIdRef.current);
          return;
        }
      }

      // Undo / Redo (Mac: ⌘Z, ⌘⇧Z, ⌘Y; Windows: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      const isZ = e.key.toLowerCase() === "z" || e.code === "KeyZ";
      const isY = e.key.toLowerCase() === "y" || e.code === "KeyY";
      const isMod = e.ctrlKey || e.metaKey;

      if (!isMod) return;

      if (isZ) {
        if (e.shiftKey) {
          // Redo: Cmd+Shift+Z or Ctrl+Shift+Z
          e.preventDefault();
          if (target && "blur" in target) target.blur();
          handleRedo();
        } else {
          // Undo: Cmd+Z or Ctrl+Z
          if (!isTextEntry) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if (isY) {
        // Redo: Cmd+Y or Ctrl+Y
        e.preventDefault();
        if (target && "blur" in target) target.blur();
        handleRedo();
      }

      // Zoom In / Out / Fit via keyboard: Cmd/Ctrl + (+/=), Cmd/Ctrl + -, Cmd/Ctrl + 0
      if (isMod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setScale((s) => Math.min(2.0, Number((s + 0.1).toFixed(1))));
        return;
      }
      if (isMod && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        setScale((s) => Math.max(0.3, Number((s - 0.1).toFixed(1))));
        return;
      }
      if (isMod && e.key === "0") {
        e.preventDefault();
        setScale(0.8);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleNudgeBlock]);

  // Touchpad pinch-to-zoom & Ctrl/Cmd+wheel canvas zoom without zooming the browser page
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Touchpad pinch gestures emit wheel events with ctrlKey = true.
      // Ctrl+wheel and Cmd+wheel also zoom the canvas instead of zooming the entire browser page.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        // Calculate smooth exponential zoom based on deltaY
        // deltaY is negative when pinching out (zoom in) and positive when pinching in (zoom out)
        const zoomSensitivity = 0.003;
        const zoomMultiplier = Math.exp(-e.deltaY * zoomSensitivity);

        setScale((prev) => {
          const next = prev * zoomMultiplier;
          // Clamp between 30% and 200% zoom
          return Number(Math.min(2.0, Math.max(0.3, next)).toFixed(3));
        });
      }
    };

    // Safari on macOS emits gesture events during trackpad pinch
    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("gesturestart", handleGesture, { passive: false });
    window.addEventListener("gesturechange", handleGesture, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("gesturestart", handleGesture);
      window.removeEventListener("gesturechange", handleGesture);
    };
  }, []);

  // Autosave draft to localStorage
  useEffect(() => {
    const key = `framebooks_layout_draft_${layoutId}`;
    try {
      localStorage.setItem(key, JSON.stringify({ layoutName, definition, isDefault }));
    } catch {
      // LocalStorage quota or privacy
    }
  }, [layoutName, definition, isDefault, layoutId]);

  // Restore draft if available for new layouts
  useEffect(() => {
    if (isNew) {
      const key = `framebooks_layout_draft_${layoutId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.definition) {
            const cloned = JSON.parse(JSON.stringify(parsed.definition));
            setDefinition(cloned);
            setHistory([cloned]);
            setHistoryIndex(0);
            historyRef.current = [cloned];
            historyIndexRef.current = 0;
            if (parsed.layoutName) setLayoutName(parsed.layoutName);
          }
        } catch { }
      }
    }
  }, [isNew, layoutId]);

  const paperRef = useRef<HTMLDivElement>(null);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);

  // Find currently selected block and its location
  let selectedBlock: LayoutBlock | null = null;
  let selectedRowIndex = -1;
  let selectedColIndex = -1;
  let selectedBlockIndex = -1;

  definition.sections.forEach((sec, rIdx) => {
    sec.columns.forEach((col, cIdx) => {
      col.blocks.forEach((b, bIdx) => {
        if (b.id === selectedBlockId) {
          selectedBlock = b;
          selectedRowIndex = rIdx;
          selectedColIndex = cIdx;
          selectedBlockIndex = bIdx;
        }
      });
    });
  });

  const compulsoryStatus = validateCompulsoryBlocks(definition);

  const handleSelectBlock = (id: string) => {
    setSelectedBlockId(id);
    setActiveInspectorTab("block");
  };

  const getDefaultBlockWidth = (type: BlockType) => {
    switch (type) {
      case "items_table":
      case "notes":
      case "terms":
        return 170;
      case "items_col_desc":
        return 80;
      case "items_col_qty":
        return 20;
      case "items_col_price":
      case "items_col_amount":
        return 35;
      case "business_header":
      case "text_block":
        return 100;
      case "business_address":
      case "client_address":
      case "client_name":
      case "bank_details":
      case "business_info":
      case "bill_to":
        return 85;
      case "client_email":
      case "client_phone":
      case "business_email":
      case "business_phone":
      case "business_website":
      case "bank_name":
      case "bank_acc_name":
      case "bank_acc_number":
      case "bank_branch":
      case "signature":
      case "custom_field":
        return 70;
      case "invoice_meta":
      case "totals_summary":
        return 75;
      case "document_title":
      case "invoice_number":
      case "invoice_date":
      case "due_date":
      case "total_subtotal":
      case "total_discount":
      case "total_tax":
      case "total_advance":
      case "total_invoice":
      case "total_due":
        return 65;
      case "client_header":
      case "amount_due_callout":
      case "image_block":
      case "logo":
        return 50;
      default:
        return 80;
    }
  };

  const getInitialBlockProps = (type: BlockType): Record<string, any> => {
    switch (type) {
      case "text_block":
        return { content: "Add your custom note, payment terms, or announcement text here." };
      case "invoice_meta":
        return { title: "INVOICE", showDueDate: true };
      case "document_title":
        return { title: "INVOICE" };
      case "invoice_number":
        return { label: "Invoice No: ", showLabel: true };
      case "invoice_date":
        return { label: "Date: ", showLabel: true };
      case "due_date":
        return { label: "Due Date: ", showLabel: true };
      case "client_header":
        return { label: "Bill To:" };
      case "client_name":
        return { label: "", showLabel: false };
      case "client_address":
        return { label: "", showLabel: false };
      case "client_email":
        return { label: "Email: ", showLabel: true };
      case "client_phone":
        return { label: "Phone: ", showLabel: true };
      case "business_address":
        return { label: "", showLabel: false };
      case "business_phone":
        return { label: "Tel: ", showLabel: true };
      case "business_email":
        return { label: "Email: ", showLabel: true };
      case "business_website":
        return { label: "Web: ", showLabel: true };
      case "bank_name":
        return { label: "Bank: ", showLabel: true };
      case "bank_acc_name":
        return { label: "A/C Name: ", showLabel: true };
      case "bank_acc_number":
        return { label: "A/C No: ", showLabel: true };
      case "bank_branch":
        return { label: "Branch: ", showLabel: true };
      case "total_subtotal":
        return { label: "Subtotal: ", showLabel: true, showCurrency: true };
      case "total_discount":
        return { label: "Discount: ", showLabel: true, showCurrency: true, showPrefix: true, prefix: "− " };
      case "total_tax":
        return { label: "Tax (8%): ", showLabel: true, showCurrency: true, showPrefix: true, prefix: "+ " };
      case "total_advance":
        return { label: "Advance Paid: ", showLabel: true, showCurrency: true, showPrefix: true, prefix: "− " };
      case "total_invoice":
        return { label: "Total: ", showLabel: true, showCurrency: true };
      case "total_due":
        return { label: "Balance Due: ", showLabel: true, showCurrency: true };
      case "bill_to":
        return { label: "Bill To:" };
      case "amount_due_callout":
        return { label: "Amount Due" };
      case "signature":
        return { label: "Authorized Signature" };
      case "items_table":
        return { striped: false, showHeader: true, showBorder: true, maxItems: null };
      case "items_col_desc":
        return { headerLabel: "Description", showHeader: false, rowHeightMm: 8, maxItems: null };
      case "items_col_qty":
        return { headerLabel: "Qty", showHeader: false, rowHeightMm: 8, maxItems: null };
      case "items_col_price":
        return { headerLabel: "Price", showHeader: false, rowHeightMm: 8, maxItems: null };
      case "items_col_amount":
        return { headerLabel: "Total", showHeader: false, rowHeightMm: 8, maxItems: null };
      case "image_block":
        return { maxHeight: 80, maxWidth: 180 };
      default:
        return {};
    }
  };

  // Live update block position while dragging without cluttering undo history until drop
  const updateBlockPositionLive = (blockId: string, x: number, y: number) => {
    setDefinition((prev) => {
      const nextSections = prev.sections.map((sec) => ({
        ...sec,
        columns: sec.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((b) => (b.id === blockId ? { ...b, x, y } : b)),
        })),
      }));
      return { ...prev, sections: nextSections };
    });
  };

  // Live update block width while resizing
  const updateBlockWidthLive = (blockId: string, width: number) => {
    setDefinition((prev) => {
      const nextSections = prev.sections.map((sec) => ({
        ...sec,
        columns: sec.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((b) => (b.id === blockId ? { ...b, width } : b)),
        })),
      }));
      return { ...prev, sections: nextSections };
    });
  };

  // Commit history when mouse drag completes
  const commitDragHistory = useCallback(() => {
    setDefinition((currentDef) => {
      const cloned = JSON.parse(JSON.stringify(currentDef));
      const currIdx = historyIndexRef.current;
      const currentHist = historyRef.current;
      const trimmed = currentHist.slice(0, currIdx + 1);
      const nextStack = [...trimmed, cloned];
      if (nextStack.length > 50) {
        nextStack.shift();
      }
      const nextIdx = nextStack.length - 1;

      historyRef.current = nextStack;
      historyIndexRef.current = nextIdx;
      setHistory(nextStack);
      setHistoryIndex(nextIdx);
      return cloned;
    });
  }, []);

  // Mouse drag handler for absolute blocks (Photoshop drag)
  const handleBlockMouseDown = (e: React.MouseEvent, block: LayoutBlock) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedBlockId(block.id);
    setActiveInspectorTab("block");

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startBlockX = block.x ?? 20;
    const startBlockY = block.y ?? 20;
    const pxPerMm = 3.779527559;
    const isLetter = definition.pageSize === "Letter";
    const paperWidth = isLetter ? 215.9 : 210;
    const paperHeight = isLetter ? 279.4 : 297;

    let hasMoved = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dxMm = (moveEvent.clientX - startMouseX) / (pxPerMm * scale);
      const dyMm = (moveEvent.clientY - startMouseY) / (pxPerMm * scale);

      if (Math.abs(dxMm) > 0.05 || Math.abs(dyMm) > 0.05) {
        hasMoved = true;
      }

      let newX = Math.round((startBlockX + dxMm) * 10) / 10;
      let newY = Math.round((startBlockY + dyMm) * 10) / 10;

      newX = Math.max(0, Math.min(paperWidth - (block.width || 30), newX));
      newY = Math.max(0, Math.min(paperHeight - 15, newY));

      updateBlockPositionLive(block.id, newX, newY);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (hasMoved) {
        commitDragHistory();
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Mouse resize handler for block width
  const handleBlockResizeMouseDown = (e: React.MouseEvent, block: LayoutBlock) => {
    e.stopPropagation();
    const startMouseX = e.clientX;
    const startWidth = block.width ?? 80;
    const pxPerMm = 3.779527559;
    const isLetter = definition.pageSize === "Letter";
    const paperWidth = isLetter ? 215.9 : 210;

    let hasResized = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dwMm = (moveEvent.clientX - startMouseX) / (pxPerMm * scale);
      let newWidth = Math.round((startWidth + dwMm) * 10) / 10;
      newWidth = Math.max(25, Math.min(paperWidth - (block.x || 0), newWidth));

      hasResized = true;
      updateBlockWidthLive(block.id, newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (hasResized) {
        commitDragHistory();
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Canvas Drag & Drop from left sidebar palette
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragOverCanvas) setDragOverCanvas(true);
  };

  const handleCanvasDragLeave = () => {
    setDragOverCanvas(false);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCanvas(false);
    const rawData = e.dataTransfer.getData("text/plain");
    if (!rawData) return;

    let blockType: BlockType;
    let customProps: Record<string, any> = {};

    try {
      const parsed = JSON.parse(rawData);
      blockType = parsed.type;
      if (parsed.itemIndex !== undefined) {
        customProps.itemIndex = parsed.itemIndex;
      }
    } catch {
      blockType = rawData as BlockType;
    }

    if (paperRef.current) {
      const rect = paperRef.current.getBoundingClientRect();
      const pxPerMm = 3.779527559;
      const rawX = (e.clientX - rect.left) / (pxPerMm * scale);
      const rawY = (e.clientY - rect.top) / (pxPerMm * scale);

      const isLetter = definition.pageSize === "Letter";
      const paperWidth = isLetter ? 215.9 : 210;
      const paperHeight = isLetter ? 279.4 : 297;

      let x = Math.max(5, Math.min(paperWidth - 30, Math.round(rawX * 10) / 10));
      let y = Math.max(5, Math.min(paperHeight - 20, Math.round(rawY * 10) / 10));

      handleAddBlock(blockType, { x, y }, customProps);
    }
  };

  // Inspector coordinate modifiers
  const updateBlockX = (x: number) => {
    if (!selectedBlock || selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0) return;
    const roundedX = Math.round(x * 10) / 10;
    const newSections = [...definition.sections];
    newSections[selectedRowIndex].columns[selectedColIndex].blocks[selectedBlockIndex].x = roundedX;
    updateDefinitionWithHistory({ ...definition, sections: newSections });
  };

  const updateBlockY = (y: number) => {
    if (!selectedBlock || selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0) return;
    const roundedY = Math.round(y * 10) / 10;
    const newSections = [...definition.sections];
    newSections[selectedRowIndex].columns[selectedColIndex].blocks[selectedBlockIndex].y = roundedY;
    updateDefinitionWithHistory({ ...definition, sections: newSections });
  };

  const updateBlockWidth = (width: number) => {
    if (!selectedBlock || selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0) return;
    const roundedW = Math.round(width * 10) / 10;
    const newSections = [...definition.sections];
    newSections[selectedRowIndex].columns[selectedColIndex].blocks[selectedBlockIndex].width = roundedW;
    updateDefinitionWithHistory({ ...definition, sections: newSections });
  };

  const handleDuplicateBlock = () => {
    if (!selectedBlock || selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0) return;
    const original = selectedBlock as LayoutBlock;
    const dup: LayoutBlock = {
      ...JSON.parse(JSON.stringify(original)),
      id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: original.x !== undefined ? Math.min(180, original.x + 8) : undefined,
      y: original.y !== undefined ? Math.min(270, original.y + 8) : undefined,
    };
    const newSections = [...definition.sections];
    newSections[selectedRowIndex].columns[selectedColIndex].blocks.push(dup);
    updateDefinitionWithHistory({ ...definition, sections: newSections });
    setSelectedBlockId(dup.id);
  };

  const handleAddBlock = (
    type: BlockType,
    dropCoords?: { x: number; y: number },
    customProps?: Record<string, any>,
    customStyles?: BlockStyle
  ) => {
    const isSingleItem = customProps?.itemIndex !== undefined;
    const defaultW = isSingleItem
      ? (type === "items_col_desc" ? 75 : type === "items_col_qty" ? 20 : 35)
      : getDefaultBlockWidth(type);
    const isFreeform = Boolean(dropCoords || definition.theme.backgroundImage || definition.sections.length === 0);

    let initialX = dropCoords?.x;
    let initialY = dropCoords?.y;

    if (isFreeform && (initialX === undefined || initialY === undefined)) {
      const existingCount = definition.sections.reduce((acc, s) => acc + s.columns.reduce((a, c) => a + c.blocks.length, 0), 0);
      initialX = 20;
      initialY = Math.min(240, 25 + existingCount * 25);
    }

    const defaultAlign = type === "items_col_desc"
      ? "left"
      : (type === "items_col_qty" || type === "items_col_price" || type === "items_col_amount")
        ? "right"
        : "left";

    const newBlock: LayoutBlock = {
      id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      x: initialX,
      y: initialY,
      width: isFreeform ? defaultW : undefined,
      height: isSingleItem ? 8 : undefined,
      props: {
        ...getInitialBlockProps(type),
        ...(customProps || {}),
      },
      styles: {
        align: defaultAlign,
        ...(customStyles || {}),
      },
    };

    const newSections = [...definition.sections];
    if (newSections.length === 0) {
      newSections.push({
        id: `sec_${Date.now()}`,
        columns: [{ id: `col_${Date.now()}`, widthRatio: 12, blocks: [] }],
      });
    }

    if (!isFreeform && selectedRowIndex >= 0 && selectedColIndex >= 0) {
      newSections[selectedRowIndex].columns[selectedColIndex].blocks.push(newBlock);
    } else {
      const lastSec = newSections[newSections.length - 1];
      const lastCol = lastSec.columns[0];
      lastCol.blocks.push(newBlock);
    }

    updateDefinitionWithHistory({ ...definition, sections: newSections });
    setSelectedBlockId(newBlock.id);
    setActiveInspectorTab("block");
  };

  const splitColumnIntoLines = (colBlock: LayoutBlock) => {
    const limit = definition.lineItemsLimit && definition.lineItemsLimit > 0 ? definition.lineItemsLimit : 3;
    const rowHeight = colBlock.props?.rowHeightMm ? Number(colBlock.props.rowHeightMm) : 8;
    const newBlocks: LayoutBlock[] = [];

    for (let i = 0; i < limit; i++) {
      newBlocks.push({
        id: `${colBlock.type}_line_${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: colBlock.type,
        props: {
          ...colBlock.props,
          itemIndex: i,
          showHeader: false,
        },
        styles: { ...(colBlock.styles || {}) },
        x: colBlock.x !== undefined ? colBlock.x : 20,
        y: colBlock.y !== undefined ? colBlock.y + i * rowHeight : 100 + i * rowHeight,
        width: colBlock.width || (colBlock.type === "items_col_desc" ? 80 : 30),
        height: rowHeight,
        zIndex: colBlock.zIndex || 20,
      });
    }

    const newSections = definition.sections.map((section) => ({
      ...section,
      columns: section.columns.map((col) => ({
        ...col,
        blocks: col.blocks.flatMap((b) => (b.id === colBlock.id ? newBlocks : [b])),
      })),
    }));

    updateDefinitionWithHistory({
      ...definition,
      sections: newSections,
    });
    setSelectedBlockId(newBlocks[0].id);
    setSuccessMsg(`Column split into ${limit} separate draggable line items.`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const splitAllColumnsIntoLines = () => {
    const limit = definition.lineItemsLimit && definition.lineItemsLimit > 0 ? definition.lineItemsLimit : 3;
    let anySplit = false;

    const newSections = definition.sections.map((section) => ({
      ...section,
      columns: section.columns.map((col) => ({
        ...col,
        blocks: col.blocks.flatMap((b) => {
          if (["items_col_desc", "items_col_qty", "items_col_price", "items_col_amount"].includes(b.type) && b.props?.itemIndex === undefined) {
            anySplit = true;
            const rowHeight = b.props?.rowHeightMm ? Number(b.props.rowHeightMm) : 8;
            const list: LayoutBlock[] = [];
            for (let i = 0; i < limit; i++) {
              list.push({
                id: `${b.type}_line_${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                type: b.type,
                props: {
                  ...b.props,
                  itemIndex: i,
                  showHeader: false,
                },
                styles: { ...(b.styles || {}) },
                x: b.x !== undefined ? b.x : 20,
                y: b.y !== undefined ? b.y + i * rowHeight : 100 + i * rowHeight,
                width: b.width || (b.type === "items_col_desc" ? 80 : 30),
                height: rowHeight,
                zIndex: b.zIndex || 20,
              });
            }
            return list;
          }
          return [b];
        }),
      })),
    }));

    if (anySplit) {
      updateDefinitionWithHistory({ ...definition, sections: newSections });
      setSuccessMsg(`All item columns split into ${limit} individual draggable line items.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleAddRow = (colCount: 1 | 2 | 3) => {
    const colRatios = colCount === 1 ? [12] : colCount === 2 ? [6, 6] : [4, 4, 4];
    const newRow: SectionRow = {
      id: `sec_${Date.now()}`,
      name: `${colCount}-Column Section`,
      paddingBottom: 15,
      columns: colRatios.map((ratio, idx) => ({
        id: `col_${Date.now()}_${idx}`,
        widthRatio: ratio,
        blocks: [],
      })),
    };
    updateDefinitionWithHistory({ ...definition, sections: [...definition.sections, newRow] });
  };

  const handleDeleteBlock = (id: string) => {
    const newSections = definition.sections.map((sec) => ({
      ...sec,
      columns: sec.columns.map((col) => ({
        ...col,
        blocks: col.blocks.filter((b) => b.id !== id),
      })),
    }));
    updateDefinitionWithHistory({ ...definition, sections: newSections });
    setSelectedBlockId(null);
    setActiveInspectorTab("document");
  };
  handleDeleteBlockRef.current = handleDeleteBlock;

  const handleMoveBlock = (direction: "up" | "down") => {
    if (selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0) return;
    const col = definition.sections[selectedRowIndex].columns[selectedColIndex];
    const targetIdx = direction === "up" ? selectedBlockIndex - 1 : selectedBlockIndex + 1;
    if (targetIdx < 0 || targetIdx >= col.blocks.length) return;

    const newBlocks = [...col.blocks];
    const temp = newBlocks[selectedBlockIndex];
    newBlocks[selectedBlockIndex] = newBlocks[targetIdx];
    newBlocks[targetIdx] = temp;

    const newSections = [...definition.sections];
    newSections[selectedRowIndex].columns[selectedColIndex].blocks = newBlocks;
    updateDefinitionWithHistory({ ...definition, sections: newSections });
  };

  // Helper to update props of currently selected block
  const updateBlockProps = (newProps: Record<string, any>) => {
    const curId = selectedBlockIdRef.current || selectedBlockId;
    if (!curId) return;

    const nextSections = definition.sections.map((sec) => ({
      ...sec,
      columns: sec.columns.map((col) => ({
        ...col,
        blocks: col.blocks.map((b) =>
          b.id === curId
            ? { ...b, props: { ...(b.props || {}), ...newProps } }
            : b
        ),
      })),
    }));

    updateDefinitionWithHistory({ ...definition, sections: nextSections });
  };

  // Helper to update styles of currently selected block
  const updateBlockStyles = (newStyles: Partial<BlockStyle>) => {
    const curId = selectedBlockIdRef.current || selectedBlockId;
    if (!curId) return;

    const nextSections = definition.sections.map((sec) => ({
      ...sec,
      columns: sec.columns.map((col) => ({
        ...col,
        blocks: col.blocks.map((b) =>
          b.id === curId
            ? { ...b, styles: { ...(b.styles || {}), ...newStyles } }
            : b
        ),
      })),
    }));

    updateDefinitionWithHistory({ ...definition, sections: nextSections });
  };

  // Clear all existing blocks/sections from canvas
  const handleClearCanvas = () => {
    if (definition.sections.length === 0) return;
    updateDefinitionWithHistory({
      ...definition,
      sections: [],
    });
    setSelectedBlockId(null);
    setSuccessMsg("Canvas cleared. All existing blocks removed.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Upload blank format background template file to CDN
  const handleUploadBackgroundFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSuccessMsg("Uploading background to CDN...");
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadInvoiceLayoutAsset(formData);

      if (res.success && res.url) {
        // When user adds an image, preserve existing added items in their places
        updateDefinitionWithHistory({
          ...definition,
          theme: {
            ...definition.theme,
            backgroundImage: res.url,
            backgroundOpacity: definition.theme.backgroundOpacity ?? 1,
            backgroundFit: definition.theme.backgroundFit ?? "cover",
          },
        });
        setSuccessMsg("Background image uploaded to CDN successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Failed to upload background image.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload background image to CDN.");
    } finally {
      e.target.value = "";
    }
  };

  // Upload custom image into an image_block or signature to CDN
  const handleUploadBlockImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBlock) return;

    setSuccessMsg("Uploading image to CDN...");
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadInvoiceLayoutAsset(formData);

      if (res.success && res.url) {
        if (selectedBlock?.type === "signature") {
          updateBlockProps({ signatureImageUrl: res.url });
        } else {
          updateBlockProps({ url: res.url });
        }
        setSuccessMsg("Image uploaded to CDN successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || "Failed to upload image.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload image to CDN.");
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await saveInvoiceLayout({
        id: isNew ? undefined : layoutId,
        name: layoutName,
        pageSize: definition.pageSize,
        definition,
        isDefault,
        documentType,
      });

      if (res.success) {
        setSuccessMsg("Layout saved successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
        if (isNew && res.id) {
          router.replace(`/user/settings/invoice-layout/builder/${res.id}`);
        }
      } else {
        setErrorMsg(res.error || "Failed to save layout.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await saveInvoiceLayout({
        name: `${layoutName} (Copy)`,
        pageSize: definition.pageSize,
        definition,
        isDefault: false,
        documentType,
      });

      if (res.success && res.id) {
        setSuccessMsg("Layout duplicated successfully! Opening copy...");
        setTimeout(() => {
          router.push(`/user/settings/invoice-layout/builder/${res.id}`);
        }, 600);
      } else {
        setErrorMsg(res.error || "Failed to duplicate layout.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 -mb-8 flex flex-col h-[calc(100vh-5rem)] overflow-hidden bg-transparent text-foreground">
      {/* Hidden file inputs */}
      <input
        ref={bgFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadBackgroundFile}
        className="hidden"
      />
      <input
        ref={blockImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadBlockImage}
        className="hidden"
      />

      {/* Top Navbar */}
      <header className="h-16 px-4 border-b border-border/80 bg-card/40 backdrop-blur-md flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/user/settings/invoice-layout"
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Back to Layouts"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <input
              type="text"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="text-sm font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-brand-500 outline-none px-1 py-0.5"
              placeholder="Layout Name"
            />
          </div>
        </div>

        {/* Center: Undo/Redo & Compliance Indicator */}
        <div className="flex items-center gap-3">
          {/* Undo / Redo controls */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
            <button
              type="button"
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Undo (Ctrl+Z / ⌘Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Redo (Ctrl+Y / ⌘⇧Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Blank Format Background Quick Button */}
          <button
            type="button"
            onClick={() => {
              setActiveInspectorTab("document");
              bgFileInputRef.current?.click();
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Upload pre-designed blank format background"
          >
            <Upload className="w-3.5 h-3.5 text-brand-500" />
            <span>{definition.theme.backgroundImage ? "Change Blank Format" : "Upload Blank Format"}</span>
          </button>
        </div>

        {/* Right actions: Zoom controls, Clear, Reset, Save */}
        <div className="flex items-center gap-2">
          {/* Zoom controls bar */}
          <div className="flex items-center gap-1 bg-muted/40 border border-border px-2 py-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.3, Number((s - 0.1).toFixed(1))))}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-medium text-foreground w-9 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.0, Number((s + 0.1).toFixed(1))))}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="w-px h-3.5 bg-border mx-0.5" />
            <button
              type="button"
              onClick={() => setScale(0.8)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer px-1 py-0.5 rounded hover:bg-muted transition-colors"
              title="Reset Zoom to 80%"
            >
              Fit
            </button>
          </div>

          <span className="w-px h-4 bg-border hidden sm:inline-block" />

          <button
            type="button"
            onClick={handleClearCanvas}
            title="Clear all existing blocks from the canvas"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => updateDefinitionWithHistory(STANDARD_LAYOUT_DEFINITION)}
            title="Reset layout to default template"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {!isNew && (
            <button
              type="button"
              disabled={saving}
              onClick={handleDuplicate}
              title="Duplicate this layout as a new copy"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </header>

      {/* Error & Success Feedback Banners */}
      {errorMsg && (
        <div className="px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <span className="font-medium">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-300">
            ×
          </button>
        </div>
      )}
      {successMsg && (
        <div className="px-4 py-2.5 bg-green-500/10 border-b border-green-500/20 text-green-400 text-xs flex items-center justify-between">
          <span className="font-medium">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-green-300">
            ×
          </button>
        </div>
      )}

      {/* Main 3-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Block Palette */}
        <aside className="w-72 border-r border-border/80 bg-card/25 backdrop-blur-md flex flex-col shrink-0 overflow-y-auto p-4 space-y-3">
          {/* Helper function to render a category */}
          {[
            {
              category: "Separate Fields" as const,
            },
            {
              category: "Separate Client" as const,
            },
            {
              category: "Separate Totals" as const,
            },
            {
              category: "Table" as const,
            },
            {
              category: "Brand" as const,
            },
            {
              category: "Payment" as const,
            },
            {
              title: "Custom",
              category: "Custom" as const,
            },
            {
              category: "Extra" as const,
            },
          ].map((cat) => {
            const blocks = PALETTE_BLOCKS.filter((p) => p.category === cat.category);
            if (blocks.length === 0) return null;
            return (
              <div key={cat.category}>
                {cat.title && (
                  <div className="mb-2 pt-2 border-t border-border/50">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat.title}</h3>
                  </div>
                )}
                <div className="space-y-1.5">
                  {blocks.map((pb) => {
                    const IconComponent = pb.icon;
                    return (
                      <button
                        key={pb.type}
                        type="button"
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", pb.type);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => handleAddBlock(pb.type)}
                        className="w-full flex items-center justify-between p-2 rounded-xl border border-border/70 bg-card/35 hover:bg-card/70 hover:border-brand-500/50 text-left transition-all text-xs font-medium text-foreground cursor-grab active:cursor-grabbing group shadow-2xs"
                        title="Drag and drop onto canvas or click to add"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <IconComponent className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                          <span className="truncate">{pb.name}</span>
                        </div>
                        <Move className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-brand-500 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </aside>

        {/* CENTER PANEL: Live Interactive Canvas */}
        <main
          onClick={() => {
            setSelectedBlockId(null);
            setActiveInspectorTab("document");
          }}
          className="flex-1 bg-transparent overflow-y-auto p-8 flex flex-col items-center relative"
        >


          {/* Blank Format Upload Banner when starting a new layout or no background */}
          {!definition.theme.backgroundImage && (
            <div className="mb-4 max-w-lg w-full bg-card/40 backdrop-blur-md border border-border/80 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  Have a company blank format image? Upload it to add fields over it.
                </span>
              </div>
              <button
                type="button"
                onClick={() => bgFileInputRef.current?.click()}
                className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl font-bold shrink-0 cursor-pointer"
              >
                Upload
              </button>
            </div>
          )}

          {/* Invoice Document Paper Canvas with Photoshop Drag & Drop */}
          <InvoiceRenderer
            paperRef={paperRef}
            layout={definition}
            invoice={SAMPLE_INVOICE_DATA}
            tenantInfo={SAMPLE_TENANT_INFO}
            plan="Pro Plus"
            scale={scale}
            selectedBlockId={selectedBlockId}
            onSelectBlock={handleSelectBlock}
            onBlockDragStart={handleBlockMouseDown}
            onBlockResizeStart={handleBlockResizeMouseDown}
            onCanvasDrop={handleCanvasDrop}
            onCanvasDragOver={handleCanvasDragOver}
            dragOverActive={dragOverCanvas}
          />
        </main>

        {/* RIGHT PANEL: Inspector & Content Editor */}
        <aside className="w-80 border-l border-border/80 bg-card/25 backdrop-blur-md flex flex-col shrink-0 overflow-y-auto p-4 space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <button
              type="button"
              onClick={() => setActiveInspectorTab("document")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeInspectorTab === "document"
                ? "bg-brand-500 text-brand-900"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Document & BG
            </button>
            <button
              type="button"
              onClick={() => setActiveInspectorTab("block")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeInspectorTab === "block"
                ? "bg-brand-500 text-brand-900"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Block Content
            </button>
          </div>

          {activeInspectorTab === "document" ? (
            /* Document & Background Inspector */
            <div className="space-y-4 text-xs">
              {/* Background Template / Blank Format */}
              <div className="p-3 bg-muted/30 border border-border rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground">
                    Blank Format / Background
                  </label>
                  {definition.theme.backgroundImage && (
                    <button
                      type="button"
                      onClick={() =>
                        updateDefinitionWithHistory({
                          ...definition,
                          theme: { ...definition.theme, backgroundImage: undefined },
                        })
                      }
                      className="text-red-500 hover:text-red-400 text-[11px] font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bgFileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 bg-card/40 hover:bg-card/70 border border-border hover:border-brand-500/50 rounded-xl text-center font-semibold text-foreground flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-brand-500" />
                    <span>{definition.theme.backgroundImage ? "Replace Image" : "Upload Image"}</span>
                  </button>
                </div>

                {definition.theme.backgroundImage && (
                  <div className="space-y-2 pt-1 border-t border-border">
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Opacity</span>
                        <span>{Math.round((definition.theme.backgroundOpacity ?? 1) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={definition.theme.backgroundOpacity ?? 1}
                        onChange={(e) =>
                          updateDefinitionWithHistory({
                            ...definition,
                            theme: {
                              ...definition.theme,
                              backgroundOpacity: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-brand-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Fit Mode</label>
                      <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xl">
                        {(["cover", "contain", "fill"] as const).map((fit) => (
                          <button
                            key={fit}
                            type="button"
                            onClick={() =>
                              updateDefinitionWithHistory({
                                ...definition,
                                theme: { ...definition.theme, backgroundFit: fit },
                              })
                            }
                            className={`py-1 text-[11px] font-semibold rounded-lg capitalize transition-colors ${(definition.theme.backgroundFit || "cover") === fit
                              ? "bg-brand-500 text-brand-900"
                              : "text-muted-foreground hover:text-foreground"
                              }`}
                          >
                            {fit}
                          </button>
                        ))}
                      </div>
                    </div>

                    {definition.sections.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearCanvas}
                        className="w-full py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-center font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors mt-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear Existing Blocks Over Image</span>
                      </button>
                    )}
                    {definition.sections.length === 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateDefinitionWithHistory({
                            ...definition,
                            sections: STANDARD_LAYOUT_DEFINITION.sections,
                          })
                        }
                        className="w-full py-1.5 px-3 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl text-center font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors mt-2"
                      >
                        <RotateCcw className="w-3 h-3 text-brand-500" />
                        <span>Restore Standard Layout Blocks</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Document Type / Scope */}
              <div className="p-3 bg-muted/30 border border-border rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground">
                    Apply Format To
                  </label>
                  <span className="text-[10px] font-semibold text-brand-500 capitalize bg-brand-500/10 px-2 py-0.5 rounded-full">
                    {documentType === "both"
                      ? "Both Documents"
                      : documentType === "invoice"
                      ? "Invoice Only"
                      : documentType === "quotation"
                      ? "Quotation Only"
                      : "Off"}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-muted/40 p-1 rounded-xl">
                  {([
                    { id: "both", label: "Both" },
                    { id: "invoice", label: "Invoice" },
                    { id: "quotation", label: "Quotation" },
                    { id: "off", label: "Off" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDocumentType(opt.id)}
                      className={`py-1.5 px-1 text-[11px] font-semibold rounded-lg transition-all text-center cursor-pointer ${documentType === opt.id
                        ? "bg-brand-500 text-brand-900 shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/30"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Page Size</label>
                <select
                  value={definition.pageSize}
                  onChange={(e) =>
                    updateDefinitionWithHistory({ ...definition, pageSize: e.target.value as any })
                  }
                  className="w-full bg-card/40 hover:bg-card/60 border border-border rounded-xl px-3 py-2 text-foreground focus:border-brand-500 outline-none transition-colors cursor-pointer"
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="Letter">US Letter (8.5 × 11 in)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-foreground">Line Items Capacity</label>
                  <span className="text-[11px] font-semibold text-brand-500">
                    {definition.lineItemsLimit ? `Max ${definition.lineItemsLimit} items` : "Unlimited"}
                  </span>
                </div>
                <select
                  value={definition.lineItemsLimit ?? "unlimited"}
                  onChange={(e) => {
                    const val = e.target.value === "unlimited" ? null : parseInt(e.target.value, 10);
                    updateDefinitionWithHistory({
                      ...definition,
                      lineItemsLimit: val,
                    });
                  }}
                  className="w-full bg-card/40 hover:bg-card/60 border border-border rounded-xl px-3 py-2 text-foreground focus:border-brand-500 outline-none transition-colors cursor-pointer text-xs"
                >
                  <option value="unlimited">Unlimited (flexible multi-page)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 18, 20].map((num) => (
                    <option key={num} value={num}>
                      Fixed {num} Line Item{num > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Font Family</label>
                <select
                  value={definition.theme.fontFamily}
                  onChange={(e) =>
                    updateDefinitionWithHistory({
                      ...definition,
                      theme: { ...definition.theme, fontFamily: e.target.value as any },
                    })
                  }
                  className="w-full bg-card/40 hover:bg-card/60 border border-border rounded-xl px-3 py-2 text-foreground focus:border-brand-500 outline-none transition-colors cursor-pointer"
                >
                  <option value="Helvetica">Helvetica / Arial (Standard)</option>
                  <option value="Inter">Inter (Modern Clean)</option>
                  <option value="Product Sans">Product Sans (Signature)</option>
                  <option value="Times">Times New Roman (Classic)</option>
                  <option value="Courier">Courier (Monospace)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Primary Brand Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={definition.theme.primaryColor}
                    onChange={(e) =>
                      updateDefinitionWithHistory({
                        ...definition,
                        theme: { ...definition.theme, primaryColor: e.target.value },
                      })
                    }
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={definition.theme.primaryColor}
                    onChange={(e) =>
                      updateDefinitionWithHistory({
                        ...definition,
                        theme: { ...definition.theme, primaryColor: e.target.value },
                      })
                    }
                    className="flex-1 bg-card/40 hover:bg-card/60 border border-border rounded-xl px-3 py-1.5 font-mono text-xs uppercase focus:border-brand-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Base Font Size (pt)</label>
                <input
                  type="number"
                  min={8}
                  max={16}
                  value={definition.theme.baseFontSize}
                  onChange={(e) =>
                    updateDefinitionWithHistory({
                      ...definition,
                      theme: { ...definition.theme, baseFontSize: Number(e.target.value) || 10 },
                    })
                  }
                  className="w-full bg-card/40 hover:bg-card/60 border border-border rounded-xl px-3 py-2 text-foreground focus:border-brand-500 outline-none transition-colors"
                />
              </div>

            </div>
          ) : (
            /* Block Inspector & Content Editor */
            <div className="space-y-4 text-xs">
              {!selectedBlock ? (
                <p className="text-muted-foreground text-center py-8">
                  Click any block on the invoice canvas to edit its text, images, typography, and styling.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div>
                      <h4 className="font-bold text-foreground">
                        {(selectedBlock as LayoutBlock).props?.itemIndex !== undefined
                          ? `Line ${(selectedBlock as LayoutBlock).props.itemIndex + 1} ${(selectedBlock as LayoutBlock).type.replace("items_col_", "").replace("_", " ")}`
                          : (PALETTE_BLOCKS.find((p) => p.type === (selectedBlock as LayoutBlock).type)?.name || (selectedBlock as LayoutBlock).type.replaceAll("_", " "))}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveBlock("up")}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveBlock("down")}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      {!(selectedBlock as LayoutBlock).isCompulsory && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock((selectedBlock as LayoutBlock).id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 cursor-pointer"
                          title="Delete Block"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {(selectedBlock as LayoutBlock).isCompulsory && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-2 text-[11px]">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>Required standard block for invoice validity.</span>
                    </div>
                  )}

                  {/* QUICK FIELD STYLE (BOLD / ITALIC SHORTCUTS) */}
                  {!["divider", "spacer", "image_block", "logo"].includes((selectedBlock as LayoutBlock).type) && (
                    <div className="flex items-center justify-between p-2.5 bg-muted/30 border border-border rounded-2xl">
                      <div>
                        <span className="text-xs font-bold text-foreground">Field Style</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const isBold = (selectedBlock as LayoutBlock).styles?.fontWeight === "bold";
                            updateBlockStyles({ fontWeight: isBold ? "normal" : "bold" });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            (selectedBlock as LayoutBlock).styles?.fontWeight === "bold"
                              ? "bg-brand-500 text-brand-900 shadow-xs"
                              : "bg-card/40 border border-border text-muted-foreground hover:text-foreground hover:bg-card/70"
                          }`}
                          title="Toggle Bold"
                        >
                          <Bold className="w-3.5 h-3.5" />
                          <span>Bold</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const isItalic = (selectedBlock as LayoutBlock).styles?.fontStyle === "italic";
                            updateBlockStyles({ fontStyle: isItalic ? "normal" : "italic" });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs italic flex items-center gap-1.5 transition-all cursor-pointer ${
                            (selectedBlock as LayoutBlock).styles?.fontStyle === "italic"
                              ? "bg-brand-500 text-brand-900 shadow-xs"
                              : "bg-card/40 border border-border text-muted-foreground hover:text-foreground hover:bg-card/70"
                          }`}
                          title="Toggle Italic"
                        >
                          <Italic className="w-3.5 h-3.5" />
                          <span>Italic</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PHOTOSHOP POSITION & DIMENSIONS (FREEFORM MM) */}
                  <div className="space-y-3 p-3 bg-muted/20 border border-border rounded-2xl">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                        Position & Size (mm)
                      </h5>
                      <button
                        type="button"
                        onClick={handleDuplicateBlock}
                        className="px-2 py-1 bg-card/40 hover:bg-card/70 border border-border rounded-lg text-[10px] font-semibold text-foreground flex items-center gap-1 cursor-pointer"
                        title="Duplicate this block"
                      >
                        <Copy className="w-3 h-3 text-muted-foreground" />
                        <span>Duplicate</span>
                      </button>
                    </div>

                    {(selectedBlock as LayoutBlock).x !== undefined ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">X (mm)</label>
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              max={200}
                              value={(selectedBlock as LayoutBlock).x ?? 0}
                              onChange={(e) => updateBlockX(parseFloat(e.target.value) || 0)}
                              className="w-full bg-card/40 hover:bg-card/60 focus:bg-card/60 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Y (mm)</label>
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              max={290}
                              value={(selectedBlock as LayoutBlock).y ?? 0}
                              onChange={(e) => updateBlockY(parseFloat(e.target.value) || 0)}
                              className="w-full bg-card/40 hover:bg-card/60 focus:bg-card/60 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Width (mm)</label>
                            <input
                              type="number"
                              step="0.1"
                              min={10}
                              max={210}
                              value={(selectedBlock as LayoutBlock).width ?? 80}
                              onChange={(e) => updateBlockWidth(parseFloat(e.target.value) || 80)}
                              className="w-full bg-card/40 hover:bg-card/60 focus:bg-card/60 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Quick Alignment Presets */}
                        <div className="pt-1">
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">Quick Align & Width</label>
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateBlockX(15)}
                              className="py-1 px-1 bg-card/40 hover:bg-card/70 border border-border rounded-lg text-[10px] font-medium text-foreground text-center cursor-pointer"
                              title="Align Left (15mm margin)"
                            >
                              Left
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const isLetter = definition.pageSize === "Letter";
                                const pw = isLetter ? 215.9 : 210;
                                const w = (selectedBlock as LayoutBlock).width || 80;
                                updateBlockX(Math.max(0, Math.round(((pw - w) / 2) * 10) / 10));
                              }}
                              className="py-1 px-1 bg-card/40 hover:bg-card/70 border border-border rounded-lg text-[10px] font-medium text-foreground text-center cursor-pointer"
                              title="Center horizontally"
                            >
                              Center
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const isLetter = definition.pageSize === "Letter";
                                const pw = isLetter ? 215.9 : 210;
                                const w = (selectedBlock as LayoutBlock).width || 80;
                                updateBlockX(Math.max(0, Math.round((pw - 15 - w) * 10) / 10));
                              }}
                              className="py-1 px-1 bg-card/40 hover:bg-card/70 border border-border rounded-lg text-[10px] font-medium text-foreground text-center cursor-pointer"
                              title="Align Right (15mm margin)"
                            >
                              Right
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const isLetter = definition.pageSize === "Letter";
                                const pw = isLetter ? 215.9 : 210;
                                updateBlockX(15);
                                updateBlockWidth(Math.round((pw - 30) * 10) / 10);
                              }}
                              className="py-1 px-1 bg-card/40 hover:bg-card/70 border border-border rounded-lg text-[10px] font-medium text-foreground text-center cursor-pointer"
                              title="Full Width (15mm margins)"
                            >
                              Full
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            updateBlockX(20);
                            updateBlockY(60);
                            updateBlockWidth(85);
                          }}
                          className="w-full py-2 bg-card/40 hover:bg-brand-500/10 border border-brand-500/30 rounded-xl text-xs font-semibold text-brand-500 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Move className="w-3.5 h-3.5" />
                          <span>Convert to Freeform Field</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SPECIFIC CONTENT EDITORS ACCORDING TO BLOCK TYPE */}
                  <div className="space-y-3 p-3 bg-muted/20 border border-border rounded-2xl">
                    <h5 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                      Content Settings
                    </h5>

                    {/* 1. Custom Text Block */}
                    {(selectedBlock as LayoutBlock).type === "text_block" && (
                      <div className="space-y-2">
                        <label className="font-semibold text-foreground block">Text Message / Notes</label>
                        <textarea
                          rows={4}
                          value={(selectedBlock as LayoutBlock).props?.content || ""}
                          onChange={(e) => updateBlockProps({ content: e.target.value })}
                          placeholder="Type custom text, notice, payment instructions, or thank you message..."
                          className="w-full bg-card/40 border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-brand-500 outline-none resize-y"
                        />
                      </div>
                    )}

                    {/* 2. Custom Image / Stamp / QR */}
                    {(selectedBlock as LayoutBlock).type === "image_block" && (
                      <div className="space-y-3">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Upload Image / Stamp</label>
                          <button
                            type="button"
                            onClick={() => blockImageInputRef.current?.click()}
                            className="w-full py-2 bg-card/40 border border-border hover:border-brand-500 rounded-xl font-semibold text-foreground flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-brand-500" />
                            <span>{(selectedBlock as LayoutBlock).props?.url ? "Change Image" : "Upload Image"}</span>
                          </button>
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Or Image URL</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.url || ""}
                            onChange={(e) => updateBlockProps({ url: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Max Height (px)</label>
                            <input
                              type="number"
                              min={20}
                              max={300}
                              value={(selectedBlock as LayoutBlock).props?.maxHeight || 80}
                              onChange={(e) => updateBlockProps({ maxHeight: Number(e.target.value) || 80 })}
                              className="w-full bg-card/40 border border-border rounded-xl px-2 py-1 text-foreground"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Max Width (px)</label>
                            <input
                              type="number"
                              min={20}
                              max={400}
                              value={(selectedBlock as LayoutBlock).props?.maxWidth || 180}
                              onChange={(e) => updateBlockProps({ maxWidth: Number(e.target.value) || 180 })}
                              className="w-full bg-card/40 border border-border rounded-xl px-2 py-1 text-foreground"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. Invoice Meta */}
                    {/* Brand: Business Header */}
                    {(selectedBlock as LayoutBlock).type === "business_header" && (
                      <div className="space-y-2">
                        <label className="font-semibold text-foreground block mb-1">Business Name Display</label>
                        <input
                          type="text"
                          value={(selectedBlock as LayoutBlock).props?.name ?? ""}
                          onChange={(e) => updateBlockProps({ name: e.target.value })}
                          placeholder="Defaults to workspace business name"
                          className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                        />
                      </div>
                    )}

                    {/* Brand: Business Info */}
                    {(selectedBlock as LayoutBlock).type === "business_info" && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Legal / Registered Name</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.legalName ?? ""}
                            onChange={(e) => updateBlockProps({ legalName: e.target.value })}
                            placeholder="Defaults to workspace legal name"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Address Lines</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.address ?? ""}
                            onChange={(e) => updateBlockProps({ address: e.target.value })}
                            placeholder="e.g. 123 Business Street, City Name"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Phone</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.phone ?? ""}
                              onChange={(e) => updateBlockProps({ phone: e.target.value })}
                              placeholder="e.g. +1 234 567 890"
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Email</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.email ?? ""}
                              onChange={(e) => updateBlockProps({ email: e.target.value })}
                              placeholder="e.g. info@company.com"
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Separate Business Address */}
                    {(selectedBlock as LayoutBlock).type === "business_address" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel === true}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Address: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Address: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Address Text</label>
                          <textarea
                            rows={3}
                            value={(selectedBlock as LayoutBlock).props?.address ?? ""}
                            onChange={(e) => updateBlockProps({ address: e.target.value })}
                            placeholder="Defaults to workspace business address"
                            className="w-full bg-card/40 border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-brand-500 outline-none resize-y"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Business Phone */}
                    {(selectedBlock as LayoutBlock).type === "business_phone" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Tel: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Tel: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Phone Number</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.phone ?? ""}
                            onChange={(e) => updateBlockProps({ phone: e.target.value })}
                            placeholder="Defaults to workspace business phone"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Business Email */}
                    {(selectedBlock as LayoutBlock).type === "business_email" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Email: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Email: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Email Address</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.email ?? ""}
                            onChange={(e) => updateBlockProps({ email: e.target.value })}
                            placeholder="Defaults to workspace business email"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Business Website */}
                    {(selectedBlock as LayoutBlock).type === "business_website" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Web: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Web: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Website URL</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.website ?? ""}
                            onChange={(e) => updateBlockProps({ website: e.target.value })}
                            placeholder="Defaults to workspace business website"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* 3. Invoice Meta */}
                    {(selectedBlock as LayoutBlock).type === "invoice_meta" && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Document Title</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.title || "INVOICE"}
                            onChange={(e) => updateBlockProps({ title: e.target.value })}
                            placeholder="e.g. INVOICE, TAX INVOICE, RECEIPT"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Invoice No. Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.invoiceNoLabel ?? "Invoice No: "}
                              onChange={(e) => updateBlockProps({ invoiceNoLabel: e.target.value })}
                              placeholder="Invoice No: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Date Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.dateLabel ?? "Date: "}
                              onChange={(e) => updateBlockProps({ dateLabel: e.target.value })}
                              placeholder="Date: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showDueDate !== false}
                              onChange={(e) => updateBlockProps({ showDueDate: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Display Due Date</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showDueDate !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Due Date Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.dueDateLabel ?? "Due Date: "}
                              onChange={(e) => updateBlockProps({ dueDateLabel: e.target.value })}
                              placeholder="Due Date: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Separate: Document Title */}
                    {(selectedBlock as LayoutBlock).type === "document_title" && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Document Title</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.title ?? ""}
                            onChange={(e) => updateBlockProps({ title: e.target.value })}
                            placeholder="e.g. INVOICE, QUOTATION, TAX INVOICE"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate: Invoice / Quotation Number */}
                    {(selectedBlock as LayoutBlock).type === "invoice_number" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Invoice No: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Invoice No: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Separate: Invoice Date */}
                    {(selectedBlock as LayoutBlock).type === "invoice_date" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Date: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Date: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Separate: Due Date */}
                    {(selectedBlock as LayoutBlock).type === "due_date" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Due Date: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Due Date: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Separate Client Header */}
                    {(selectedBlock as LayoutBlock).type === "client_header" && (
                      <div className="space-y-2.5">
                        <label className="font-semibold text-foreground block mb-1">Section Title</label>
                        <input
                          type="text"
                          value={(selectedBlock as LayoutBlock).props?.label || "Bill To:"}
                          onChange={(e) => updateBlockProps({ label: e.target.value })}
                          placeholder="e.g. Bill To:, Client Details:, Billed To:"
                          className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                        />
                      </div>
                    )}

                    {/* Separate Client Name */}
                    {(selectedBlock as LayoutBlock).type === "client_name" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel === true}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Client: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Client: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Sample Client Name</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.clientName ?? ""}
                            onChange={(e) => updateBlockProps({ clientName: e.target.value })}
                            placeholder="Defaults to invoice client name"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Client Address */}
                    {(selectedBlock as LayoutBlock).type === "client_address" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel === true}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Address: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Address: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Sample Billing Address</label>
                          <textarea
                            rows={3}
                            value={(selectedBlock as LayoutBlock).props?.billingAddress ?? ""}
                            onChange={(e) => updateBlockProps({ billingAddress: e.target.value })}
                            placeholder="Defaults to invoice billing address"
                            className="w-full bg-card/40 border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-brand-500 outline-none resize-y"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Client Email */}
                    {(selectedBlock as LayoutBlock).type === "client_email" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Email: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Email: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Sample Client Email</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.clientEmail ?? ""}
                            onChange={(e) => updateBlockProps({ clientEmail: e.target.value })}
                            placeholder="Defaults to invoice client email"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Client Phone */}
                    {(selectedBlock as LayoutBlock).type === "client_phone" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Phone: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Phone: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Sample Client Phone</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.clientPhone ?? ""}
                            onChange={(e) => updateBlockProps({ clientPhone: e.target.value })}
                            placeholder="Defaults to invoice client phone"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* 4. Bill-To */}
                    {(selectedBlock as LayoutBlock).type === "bill_to" && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Section Heading</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.label || "Bill To:"}
                            onChange={(e) => updateBlockProps({ label: e.target.value })}
                            placeholder="e.g. Bill To:, Client Details:, Billed To:"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Default / Sample Client Name</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.clientName ?? ""}
                            onChange={(e) => updateBlockProps({ clientName: e.target.value })}
                            placeholder="e.g. Company Name"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Billing Address</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.billingAddress ?? ""}
                            onChange={(e) => updateBlockProps({ billingAddress: e.target.value })}
                            placeholder="e.g. Client Address"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* 5. Amount Due Callout */}
                    {(selectedBlock as LayoutBlock).type === "amount_due_callout" && (
                      <div className="space-y-2">
                        <label className="font-semibold text-foreground block mb-1">
                          Callout Title / Label
                        </label>
                        <input
                          type="text"
                          value={(selectedBlock as LayoutBlock).props?.label ?? ""}
                          onChange={(e) => updateBlockProps({ label: e.target.value })}
                          placeholder="e.g. Amount Due"
                          className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                        />
                      </div>
                    )}

                    {/* Individual Totals & Amounts */}
                    {(selectedBlock as LayoutBlock).type.startsWith("total_") && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>

                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Custom Label Text
                            </label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? ""}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder={
                                (selectedBlock as LayoutBlock).type === "total_subtotal"
                                  ? "Subtotal: "
                                  : (selectedBlock as LayoutBlock).type === "total_discount"
                                    ? "Discount: "
                                    : (selectedBlock as LayoutBlock).type === "total_tax"
                                      ? "Tax (8%): "
                                      : (selectedBlock as LayoutBlock).type === "total_advance"
                                        ? "Advance Paid: "
                                        : (selectedBlock as LayoutBlock).type === "total_invoice"
                                          ? "Total: "
                                          : "Balance Due: "
                              }
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showCurrency !== false}
                              onChange={(e) => updateBlockProps({ showCurrency: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Currency Symbol (e.g. Rs.)</span>
                          </label>
                        </div>

                        {((selectedBlock as LayoutBlock).type === "total_discount" || (selectedBlock as LayoutBlock).type === "total_advance") && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={(selectedBlock as LayoutBlock).props?.showPrefix !== false}
                                  onChange={(e) => updateBlockProps({ showPrefix: e.target.checked })}
                                  className="rounded border-border text-brand-500"
                                />
                                <span className="font-medium text-foreground">Show Negative Sign ( − )</span>
                              </label>
                            </div>
                            {(selectedBlock as LayoutBlock).props?.showPrefix !== false && (
                              <div>
                                <label className="font-semibold text-foreground block mb-1 text-[11px]">Prefix Character</label>
                                <input
                                  type="text"
                                  value={(selectedBlock as LayoutBlock).props?.prefix ?? "− "}
                                  onChange={(e) => updateBlockProps({ prefix: e.target.value })}
                                  placeholder="− "
                                  className="w-24 bg-card/40 border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:border-brand-500 outline-none font-mono"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {(selectedBlock as LayoutBlock).type === "total_tax" && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={(selectedBlock as LayoutBlock).props?.showPrefix !== false}
                                  onChange={(e) => updateBlockProps({ showPrefix: e.target.checked })}
                                  className="rounded border-border text-brand-500"
                                />
                                <span className="font-medium text-foreground">Show Plus Sign ( + )</span>
                              </label>
                            </div>
                            {(selectedBlock as LayoutBlock).props?.showPrefix !== false && (
                              <div>
                                <label className="font-semibold text-foreground block mb-1 text-[11px]">Prefix Character</label>
                                <input
                                  type="text"
                                  value={(selectedBlock as LayoutBlock).props?.prefix ?? "+ "}
                                  onChange={(e) => updateBlockProps({ prefix: e.target.value })}
                                  placeholder="+ "
                                  className="w-24 bg-card/40 border border-border rounded-xl px-2.5 py-1 text-xs text-foreground focus:border-brand-500 outline-none font-mono"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 6. Items Table */}
                    {(selectedBlock as LayoutBlock).type === "items_table" && (
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={(selectedBlock as LayoutBlock).props?.showHeader !== false}
                            onChange={(e) => updateBlockProps({ showHeader: e.target.checked })}
                            className="rounded border-border text-brand-500"
                          />
                          <span className="font-medium text-foreground">Show Column Headers</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={(selectedBlock as LayoutBlock).props?.showBorder !== false}
                            onChange={(e) => updateBlockProps({ showBorder: e.target.checked })}
                            className="rounded border-border text-brand-500"
                          />
                          <span className="font-medium text-foreground">Show Table Borders & Lines</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean((selectedBlock as LayoutBlock).props?.striped)}
                            onChange={(e) => updateBlockProps({ striped: e.target.checked })}
                            className="rounded border-border text-brand-500"
                          />
                          <span className="font-medium text-foreground">Alternating / Striped Rows</span>
                        </label>
                        <div>
                          <label className="font-semibold text-foreground block mb-1 text-xs">Row Height (mm)</label>
                          <input
                            type="number"
                            min={5}
                            max={30}
                            value={(selectedBlock as LayoutBlock).props?.rowHeightMm ?? 8}
                            onChange={(e) => updateBlockProps({ rowHeightMm: Number(e.target.value) || 8 })}
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1 text-xs">Items Display Limit</label>
                          <select
                            value={
                              (selectedBlock as LayoutBlock).props?.maxItems === null ||
                              (selectedBlock as LayoutBlock).props?.maxItems === undefined
                                ? "inherit"
                                : (selectedBlock as LayoutBlock).props?.maxItems
                            }
                            onChange={(e) => {
                              const val = e.target.value === "inherit" ? null : Number(e.target.value);
                              updateBlockProps({ maxItems: val });
                            }}
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          >
                            <option value="inherit">
                              Inherit Layout Limit ({definition.lineItemsLimit ? `${definition.lineItemsLimit} items` : "Unlimited"})
                            </option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 18, 20].map((num) => (
                              <option key={num} value={num}>
                                Show max {num} item{num > 1 ? "s" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Separate Line Items Columns / Individual Line Items */}
                    {["items_col_desc", "items_col_qty", "items_col_price", "items_col_amount"].includes((selectedBlock as LayoutBlock).type) && (
                      <div className="space-y-3">
                        {(selectedBlock as LayoutBlock).props?.itemIndex !== undefined ? (
                          <div className="space-y-2.5">
                            <div className="p-2.5 bg-brand-500/10 border border-brand-500/25 rounded-xl space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-brand-600 dark:text-brand-300 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                  Line Item {(selectedBlock as LayoutBlock).props.itemIndex + 1}
                                </span>
                                <span className="text-[10px] bg-brand-500/20 text-brand-700 dark:text-brand-300 px-1.5 py-0.5 rounded-md font-mono font-bold">
                                  Single Item
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="font-semibold text-foreground block mb-1 text-xs">Line Item Number</label>
                              <select
                                value={(selectedBlock as LayoutBlock).props.itemIndex}
                                onChange={(e) => updateBlockProps({ itemIndex: Number(e.target.value) })}
                                className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                              >
                                {Array.from({ length: Math.max(10, Number(definition.lineItemsLimit) || 5) }).map((_, i) => (
                                  <option key={i} value={i}>
                                    Line Item {i + 1}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="p-2.5 bg-muted/40 border border-border rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                <span>Grouped Lines Column</span>
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-mono text-muted-foreground">
                                  Grouped
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => splitColumnIntoLines(selectedBlock as LayoutBlock)}
                                className="w-full py-1.5 px-3 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <Scissors className="w-3.5 h-3.5" />
                                <span>Split into Separate Lines ({definition.lineItemsLimit || 3} blocks)</span>
                              </button>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={Boolean((selectedBlock as LayoutBlock).props?.showHeader)}
                                onChange={(e) => updateBlockProps({ showHeader: e.target.checked })}
                                className="rounded border-border text-brand-500"
                              />
                              <span className="font-medium text-foreground">Include Column Title</span>
                            </label>
                            {(selectedBlock as LayoutBlock).props?.showHeader && (
                              <div>
                                <label className="font-semibold text-foreground block mb-1 text-xs">Column Title Text</label>
                                <input
                                  type="text"
                                  value={(selectedBlock as LayoutBlock).props?.headerLabel ?? ""}
                                  onChange={(e) => updateBlockProps({ headerLabel: e.target.value })}
                                  placeholder={
                                    (selectedBlock as LayoutBlock).type === "items_col_desc"
                                      ? "Description"
                                      : (selectedBlock as LayoutBlock).type === "items_col_qty"
                                      ? "Qty"
                                      : (selectedBlock as LayoutBlock).type === "items_col_price"
                                      ? "Price"
                                      : "Amount"
                                  }
                                  className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                                />
                              </div>
                            )}
                            <div>
                              <label className="font-semibold text-foreground block mb-1 text-xs">Row Spacing / Height (mm)</label>
                              <input
                                type="number"
                                min={4}
                                max={30}
                                value={(selectedBlock as LayoutBlock).props?.rowHeightMm ?? 8}
                                onChange={(e) => updateBlockProps({ rowHeightMm: Number(e.target.value) || 8 })}
                                className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="font-semibold text-foreground block mb-1 text-xs">Items Display Limit</label>
                              <select
                                value={
                                  (selectedBlock as LayoutBlock).props?.maxItems === null ||
                                  (selectedBlock as LayoutBlock).props?.maxItems === undefined
                                    ? "inherit"
                                    : (selectedBlock as LayoutBlock).props?.maxItems
                                }
                                onChange={(e) => {
                                  const val = e.target.value === "inherit" ? null : Number(e.target.value);
                                  updateBlockProps({ maxItems: val });
                                }}
                                className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                              >
                                <option value="inherit">
                                  Inherit Layout Limit ({definition.lineItemsLimit ? `${definition.lineItemsLimit} items` : "Unlimited"})
                                </option>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 18, 20].map((num) => (
                                  <option key={num} value={num}>
                                    Show max {num} item{num > 1 ? "s" : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Separate Bank Name */}
                    {(selectedBlock as LayoutBlock).type === "bank_name" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Bank: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Bank: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Bank Name Text</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.bankName ?? ""}
                            onChange={(e) => updateBlockProps({ bankName: e.target.value })}
                            placeholder="Defaults to invoice bank name"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Bank Account Name */}
                    {(selectedBlock as LayoutBlock).type === "bank_acc_name" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "A/C Name: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="A/C Name: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Account Name Text</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.accName ?? ""}
                            onChange={(e) => updateBlockProps({ accName: e.target.value })}
                            placeholder="Defaults to invoice account name"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Bank Account Number */}
                    {(selectedBlock as LayoutBlock).type === "bank_acc_number" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "A/C No: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="A/C No: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Account Number Text</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.accNumber ?? ""}
                            onChange={(e) => updateBlockProps({ accNumber: e.target.value })}
                            placeholder="Defaults to invoice account number"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Separate Bank Branch */}
                    {(selectedBlock as LayoutBlock).type === "bank_branch" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={(selectedBlock as LayoutBlock).props?.showLabel !== false}
                              onChange={(e) => updateBlockProps({ showLabel: e.target.checked })}
                              className="rounded border-border text-brand-500"
                            />
                            <span className="font-medium text-foreground">Include Label</span>
                          </label>
                        </div>
                        {(selectedBlock as LayoutBlock).props?.showLabel !== false && (
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Prefix Label</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.label ?? "Branch: "}
                              onChange={(e) => updateBlockProps({ label: e.target.value })}
                              placeholder="Branch: "
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        )}
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Branch Code Text</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.branch ?? ""}
                            onChange={(e) => updateBlockProps({ branch: e.target.value })}
                            placeholder="Defaults to invoice bank branch"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* 7. Bank Details */}
                    {(selectedBlock as LayoutBlock).type === "bank_details" && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Title Header</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.title || "Bank Details"}
                            onChange={(e) => updateBlockProps({ title: e.target.value })}
                            placeholder="e.g. Bank Details, Wire Transfer Info"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Account Name</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.accName ?? ""}
                            onChange={(e) => updateBlockProps({ accName: e.target.value })}
                            placeholder="e.g. Company Name"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Bank Name</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.bankName ?? ""}
                              onChange={(e) => updateBlockProps({ bankName: e.target.value })}
                              placeholder="e.g. Bank Name"
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-foreground block mb-1">Branch</label>
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.branch ?? ""}
                              onChange={(e) => updateBlockProps({ branch: e.target.value })}
                              placeholder="e.g. City Branch"
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Account Number</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.accNumber ?? ""}
                            onChange={(e) => updateBlockProps({ accNumber: e.target.value })}
                            placeholder="e.g. 123456789"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* 8. Notes */}
                    {(selectedBlock as LayoutBlock).type === "notes" && (
                      <div className="space-y-3">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Section Title</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.title || "Notes"}
                            onChange={(e) => updateBlockProps({ title: e.target.value })}
                            placeholder="e.g. Notes, Comments"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Notes Content / Text</label>
                          <textarea
                            rows={3}
                            value={(selectedBlock as LayoutBlock).props?.content ?? SAMPLE_INVOICE_DATA.notes}
                            onChange={(e) => updateBlockProps({ content: e.target.value })}
                            placeholder="Thank you for partnering with us. Payment is due within 14 business days..."
                            className="w-full bg-card/40 border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-brand-500 outline-none resize-y"
                          />
                        </div>
                      </div>
                    )}

                    {/* 9. Terms & Conditions */}
                    {(selectedBlock as LayoutBlock).type === "terms" && (
                      <div className="space-y-3">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Section Title</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.title || "Terms & Conditions"}
                            onChange={(e) => updateBlockProps({ title: e.target.value })}
                            placeholder="e.g. Terms & Conditions, Payment Policy"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Terms Content / Text</label>
                          <textarea
                            rows={3}
                            value={(selectedBlock as LayoutBlock).props?.content ?? SAMPLE_INVOICE_DATA.terms}
                            onChange={(e) => updateBlockProps({ content: e.target.value })}
                            placeholder="Interest of 1.5% per month will be charged on overdue balances..."
                            className="w-full bg-card/40 border border-border rounded-xl p-2.5 text-xs text-foreground focus:border-brand-500 outline-none resize-y"
                          />
                        </div>
                      </div>
                    )}

                    {/* 10. Custom Field */}
                    {(selectedBlock as LayoutBlock).type === "custom_field" && (
                      <div className="space-y-3">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Bind to Field</label>
                          {availableCustomFields.length > 0 ? (
                            <select
                              value={(selectedBlock as LayoutBlock).props?.fieldKey || ""}
                              onChange={(e) => {
                                const selected = availableCustomFields.find((f) => f.key === e.target.value);
                                updateBlockProps({
                                  fieldKey: e.target.value,
                                  label: selected?.label || e.target.value,
                                });
                              }}
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            >
                              <option value="">Select a custom field...</option>
                              {availableCustomFields.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label} ({f.key})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={(selectedBlock as LayoutBlock).props?.fieldKey || ""}
                              onChange={(e) => updateBlockProps({ fieldKey: e.target.value })}
                              placeholder="e.g. po_number, vat_id"
                              className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none font-mono"
                            />
                          )}
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Custom Label</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.label || ""}
                            onChange={(e) => updateBlockProps({ label: e.target.value })}
                            placeholder="e.g. Purchase Order #"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* 11. Signature */}
                    {(selectedBlock as LayoutBlock).type === "signature" && (
                      <div className="space-y-3">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Signature Label</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.label || "Authorized Signature"}
                            onChange={(e) => updateBlockProps({ label: e.target.value })}
                            placeholder="e.g. Authorized Signature, Managing Director"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Subtext</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.subtext || ""}
                            onChange={(e) => updateBlockProps({ subtext: e.target.value })}
                            placeholder="e.g. On behalf of Framebooks LLC"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Signature Stamp / Image</label>
                          <button
                            type="button"
                            onClick={() => blockImageInputRef.current?.click()}
                            className="w-full py-1.5 bg-card/40 border border-border hover:border-brand-500 rounded-xl font-semibold text-foreground flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-brand-500" />
                            <span>
                              {(selectedBlock as LayoutBlock).props?.signatureImageUrl ? "Replace Signature" : "Upload Signature Image"}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 12. Spacer */}
                    {(selectedBlock as LayoutBlock).type === "spacer" && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <label className="font-semibold text-foreground">Gap Height</label>
                          <span className="font-mono text-muted-foreground">
                            {(selectedBlock as LayoutBlock).props?.height || 16}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="100"
                          value={(selectedBlock as LayoutBlock).props?.height || 16}
                          onChange={(e) => updateBlockProps({ height: Number(e.target.value) })}
                          className="w-full accent-brand-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* STYLING & TYPOGRAPHY CONTROLS */}
                  <div className="space-y-3">
                    <h5 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                      Styling & Typography
                    </h5>

                    {/* Quick Formatting Toolbar */}
                    <div>
                      <label className="font-bold text-foreground block mb-1">Quick Format</label>
                      <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border">
                        <button
                          type="button"
                          onClick={() => {
                            const isBold = selectedBlock?.styles?.fontWeight === "bold";
                            updateBlockStyles({ fontWeight: isBold ? "normal" : "bold" });
                          }}
                          className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            selectedBlock?.styles?.fontWeight === "bold"
                              ? "bg-brand-500 text-brand-900 shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                          title="Toggle Bold"
                        >
                          <Bold className="w-3.5 h-3.5" />
                          <span>Bold</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const isItalic = selectedBlock?.styles?.fontStyle === "italic";
                            updateBlockStyles({ fontStyle: isItalic ? "normal" : "italic" });
                          }}
                          className={`flex-1 py-1 px-2 rounded-lg text-xs italic flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            selectedBlock?.styles?.fontStyle === "italic"
                              ? "bg-brand-500 text-brand-900 shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                          title="Toggle Italic"
                        >
                          <Italic className="w-3.5 h-3.5" />
                          <span>Italic</span>
                        </button>
                      </div>
                    </div>

                    {/* Font Family */}
                    <div>
                      <label className="font-bold text-foreground block mb-1">Font Family</label>
                      <select
                        value={selectedBlock?.styles?.fontFamily || ""}
                        onChange={(e) => updateBlockStyles({ fontFamily: e.target.value || undefined })}
                        className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-foreground text-xs focus:border-brand-500 outline-none"
                      >
                        <option value="">Document Default ({definition.theme.fontFamily})</option>
                        <option value="Helvetica, Arial, sans-serif">Helvetica / Arial (Clean)</option>
                        <option value="Inter, sans-serif">Inter (Modern)</option>
                        <option value="'Courier New', Courier, monospace">Courier (Monospace / Typewriter)</option>
                        <option value="'Times New Roman', Times, serif">Times New Roman (Serif)</option>
                        <option value="system-ui, sans-serif">System UI</option>
                      </select>
                    </div>

                    {/* Font Weight & Font Style */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-foreground block mb-1">Font Weight</label>
                        <select
                          value={selectedBlock?.styles?.fontWeight || "normal"}
                          onChange={(e) => updateBlockStyles({ fontWeight: e.target.value as any })}
                          className="w-full bg-card/40 border border-border rounded-xl px-2 py-1.5 text-foreground text-xs focus:border-brand-500 outline-none"
                        >
                          <option value="normal">Regular (400)</option>
                          <option value="medium">Medium (500)</option>
                          <option value="semibold">Semibold (600)</option>
                          <option value="bold">Bold (700)</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-foreground block mb-1">Style</label>
                        <div className="grid grid-cols-2 gap-1 bg-muted/40 p-0.5 rounded-xl">
                          {(["normal", "italic"] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => updateBlockStyles({ fontStyle: st })}
                              className={`py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${(selectedBlock?.styles?.fontStyle || "normal") === st
                                ? "bg-brand-500 text-brand-900"
                                : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {st === "normal" ? "Normal" : "Italic"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Alignment */}
                    <div>
                      <label className="font-bold text-foreground block mb-1">Alignment</label>
                      <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xl">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateBlockStyles({ align })}
                            className={`py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${(selectedBlock?.styles?.align || "left") === align
                              ? "bg-brand-500 text-brand-900"
                              : "text-muted-foreground hover:text-foreground"
                              }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font Size */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-foreground block">Font Size (pt)</label>
                        <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                          {selectedBlock?.styles?.fontSize || definition.theme.baseFontSize || 10}pt
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(selectedBlock?.styles?.fontSize || definition.theme.baseFontSize || 10);
                            updateBlockStyles({ fontSize: Math.max(6, cur - 1) });
                          }}
                          className="w-8 h-8 rounded-xl bg-card/60 border border-border hover:bg-muted text-foreground font-bold flex items-center justify-center text-sm cursor-pointer select-none transition-colors"
                          title="Decrease Font Size"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={6}
                          max={72}
                          value={selectedBlock?.styles?.fontSize ?? definition.theme.baseFontSize ?? 10}
                          onChange={(e) => {
                            const val = e.target.value === "" ? undefined : Number(e.target.value);
                            updateBlockStyles({ fontSize: val });
                          }}
                          className="flex-1 bg-card/40 border border-border rounded-xl px-3 py-1.5 text-center text-foreground font-bold text-xs focus:border-brand-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(selectedBlock?.styles?.fontSize || definition.theme.baseFontSize || 10);
                            updateBlockStyles({ fontSize: Math.min(72, cur + 1) });
                          }}
                          className="w-8 h-8 rounded-xl bg-card/60 border border-border hover:bg-muted text-foreground font-bold flex items-center justify-center text-sm cursor-pointer select-none transition-colors"
                          title="Increase Font Size"
                        >
                          +
                        </button>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={48}
                        step={1}
                        value={Number(selectedBlock?.styles?.fontSize || definition.theme.baseFontSize || 10)}
                        onChange={(e) => updateBlockStyles({ fontSize: Number(e.target.value) })}
                        className="w-full mt-2 accent-brand-500 cursor-pointer"
                      />
                    </div>

                    {/* Padding Top & Bottom */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-foreground block mb-1">Padding Top (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={80}
                          value={selectedBlock?.styles?.paddingTop || 0}
                          onChange={(e) => updateBlockStyles({ paddingTop: Number(e.target.value) || 0 })}
                          className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-foreground block mb-1">Padding Bottom (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={80}
                          value={selectedBlock?.styles?.paddingBottom || 0}
                          onChange={(e) => updateBlockStyles({ paddingBottom: Number(e.target.value) || 0 })}
                          className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-foreground"
                        />
                      </div>
                    </div>

                    {/* Custom Text Color */}
                    <div>
                      <label className="font-bold text-foreground block mb-1">Text Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedBlock?.styles?.color || definition.theme.textColor || "#222222"}
                          onChange={(e) => updateBlockStyles({ color: e.target.value })}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={selectedBlock?.styles?.color || ""}
                          onChange={(e) => updateBlockStyles({ color: e.target.value })}
                          placeholder="Default text color"
                          className="flex-1 bg-card/40 border border-border rounded-xl px-3 py-1.5 font-mono text-xs uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
