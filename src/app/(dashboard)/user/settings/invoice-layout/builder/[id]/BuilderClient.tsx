// src/app/(dashboard)/user/settings/invoice-layout/builder/[id]/BuilderClient.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, RotateCcw, Eye, ZoomIn, ZoomOut, Check, AlertCircle,
  Trash2, ArrowUp, ArrowDown, Layout, Type, Palette, Sliders, Lock, Sparkles, Plus, Layers,
  Undo2, Redo2, Upload, Image as ImageIcon, FileText, SlidersHorizontal, AlignLeft,
  AlignCenter, AlignRight, DollarSign, Table, Calculator, CreditCard, FileCheck, PenTool,
  Minus, Maximize2, X, Move, Magnet, Copy, Calendar, Hash, Percent, Clock, Tag, User
} from "lucide-react";
import {
  InvoiceLayoutDefinition, LayoutBlock, BlockType, SectionRow, SectionColumn, BlockStyle,
  CustomFieldDefinition, LayoutDocumentType
} from "@/lib/invoice-layout/types";
import { STANDARD_LAYOUT_DEFINITION, MODERN_MINIMAL_DEFINITION } from "@/lib/invoice-layout/templates";
import { SAMPLE_INVOICE_DATA, SAMPLE_TENANT_INFO } from "@/lib/invoice-layout/sample-data";
import { InvoiceRenderer } from "@/lib/invoice-layout/renderer";
import { saveInvoiceLayout, getCustomFields } from "../../../../actions/invoice-layouts";
import { validateCompulsoryBlocks } from "@/lib/invoice-layout/compulsory-validator";

interface BuilderClientProps {
  initialLayout?: any;
  layoutId: string;
}

const PALETTE_BLOCKS: {
  type: BlockType;
  name: string;
  icon: any;
  category: "Separate Fields" | "Separate Totals" | "Grouped Blocks" | "Brand" | "Custom" | "Payment" | "Extra";
}[] = [
  // 1. Separate Metadata Fields
  { type: "invoice_number", name: "Invoice / QT No.", icon: Hash, category: "Separate Fields" },
  { type: "invoice_date", name: "Invoice Date", icon: Calendar, category: "Separate Fields" },
  { type: "due_date", name: "Due Date", icon: Clock, category: "Separate Fields" },
  { type: "document_title", name: "Document Title", icon: Type, category: "Separate Fields" },

  // 2. Separate Totals & Amounts
  { type: "total_subtotal", name: "Subtotal", icon: DollarSign, category: "Separate Totals" },
  { type: "total_discount", name: "Discount", icon: Tag, category: "Separate Totals" },
  { type: "total_tax", name: "Tax Amount", icon: Percent, category: "Separate Totals" },
  { type: "total_advance", name: "Advance Paid", icon: CreditCard, category: "Separate Totals" },
  { type: "total_invoice", name: "Total Amount", icon: Calculator, category: "Separate Totals" },
  { type: "total_due", name: "Balance Due", icon: DollarSign, category: "Separate Totals" },

  // 3. Grouped Blocks & Table
  { type: "items_table", name: "Line Items Table", icon: Table, category: "Grouped Blocks" },
  { type: "invoice_meta", name: "All Details (Grouped)", icon: FileText, category: "Grouped Blocks" },
  { type: "totals_summary", name: "Totals Summary (Grouped)", icon: Layers, category: "Grouped Blocks" },
  { type: "amount_due_callout", name: "Amount Due Callout", icon: DollarSign, category: "Grouped Blocks" },
  { type: "bill_to", name: "Client Bill-To", icon: User, category: "Grouped Blocks" },

  // 4. Brand
  { type: "logo", name: "Business Logo", icon: ImageIcon, category: "Brand" },
  { type: "business_header", name: "Business Name", icon: Type, category: "Brand" },
  { type: "business_info", name: "Address & Info", icon: FileText, category: "Brand" },

  // 5. Custom user blocks
  { type: "text_block", name: "Custom Text Block", icon: Type, category: "Custom" },
  { type: "image_block", name: "Custom Image / Stamp", icon: ImageIcon, category: "Custom" },
  { type: "custom_field", name: "Custom Field", icon: SlidersHorizontal, category: "Custom" },
  { type: "signature", name: "Signature Line", icon: PenTool, category: "Custom" },

  // 6. Payment
  { type: "bank_details", name: "Bank Details", icon: CreditCard, category: "Payment" },
  { type: "notes", name: "Notes", icon: AlignLeft, category: "Payment" },
  { type: "terms", name: "Terms & Conditions", icon: FileCheck, category: "Payment" },

  // 7. Extra
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
  const [definition, setDefinition] = useState<InvoiceLayoutDefinition>(
    initialLayout?.definition || STANDARD_LAYOUT_DEFINITION
  );
  const [isDefault, setIsDefault] = useState(Boolean(initialLayout?.is_default));
  const [scale, setScale] = useState(0.8);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<"block" | "document">("document");
  const [availableCustomFields, setAvailableCustomFields] = useState<CustomFieldDefinition[]>([]);

  // History Stack for Undo / Redo
  const [history, setHistory] = useState<InvoiceLayoutDefinition[]>([
    initialLayout?.definition || STANDARD_LAYOUT_DEFINITION,
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [draftSavedTime, setDraftSavedTime] = useState<string | null>(null);

  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const blockImageInputRef = useRef<HTMLInputElement>(null);

  // Load tenant's custom fields so user can select them
  useEffect(() => {
    getCustomFields()
      .then((fields) => setAvailableCustomFields(fields || []))
      .catch(() => { });
  }, []);

  // Update definition with undo/redo history tracking
  const updateDefinitionWithHistory = (newDef: InvoiceLayoutDefinition) => {
    setDefinition(newDef);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const nextStack = [...trimmed, newDef];
      if (nextStack.length > 50) return nextStack.slice(nextStack.length - 50);
      return nextStack;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setDefinition(history[prevIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setDefinition(history[nextIndex]);
    }
  };

  // Keyboard shortcut listener for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyIndex, history]);

  // Autosave draft to localStorage
  useEffect(() => {
    const key = `framebooks_layout_draft_${layoutId}`;
    try {
      localStorage.setItem(key, JSON.stringify({ layoutName, definition, isDefault }));
      setDraftSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
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
            setDefinition(parsed.definition);
            setHistory([parsed.definition]);
            setHistoryIndex(0);
            if (parsed.layoutName) setLayoutName(parsed.layoutName);
          }
        } catch { }
      }
    }
  }, [isNew, layoutId]);

  const paperRef = useRef<HTMLDivElement>(null);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);

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
      case "business_header":
      case "text_block":
        return 100;
      case "bank_details":
      case "business_info":
      case "bill_to":
        return 85;
      case "invoice_meta":
      case "totals_summary":
        return 75;
      case "signature":
      case "custom_field":
        return 70;
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
      case "amount_due_callout":
      case "image_block":
      case "logo":
        return 50;
      default:
        return 80;
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
  const commitDragHistory = () => {
    setDefinition((currentDef) => {
      setHistory((prevHist) => {
        const sliced = prevHist.slice(0, historyIndex + 1);
        const nextHist = [...sliced, currentDef];
        if (nextHist.length > 50) nextHist.shift();
        return nextHist;
      });
      setHistoryIndex((prevIdx) => Math.min(prevIdx + 1, 49));
      return currentDef;
    });
  };

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

      if (Math.abs(dxMm) > 0.5 || Math.abs(dyMm) > 0.5) {
        hasMoved = true;
      }

      let newX = Math.round(startBlockX + dxMm);
      let newY = Math.round(startBlockY + dyMm);

      if (snapToGrid) {
        newX = Math.round(newX / 5) * 5;
        newY = Math.round(newY / 5) * 5;
      }

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
      let newWidth = Math.round(startWidth + dwMm);
      if (snapToGrid) {
        newWidth = Math.round(newWidth / 5) * 5;
      }
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
    const blockType = e.dataTransfer.getData("text/plain") as BlockType;
    if (!blockType) return;

    if (paperRef.current) {
      const rect = paperRef.current.getBoundingClientRect();
      const pxPerMm = 3.779527559;
      const rawX = (e.clientX - rect.left) / (pxPerMm * scale);
      const rawY = (e.clientY - rect.top) / (pxPerMm * scale);

      const isLetter = definition.pageSize === "Letter";
      const paperWidth = isLetter ? 215.9 : 210;
      const paperHeight = isLetter ? 279.4 : 297;

      let x = Math.max(5, Math.min(paperWidth - 30, Math.round(rawX)));
      let y = Math.max(5, Math.min(paperHeight - 20, Math.round(rawY)));

      if (snapToGrid) {
        x = Math.round(x / 5) * 5;
        y = Math.round(y / 5) * 5;
      }

      handleAddBlock(blockType, { x, y });
    }
  };

  // Inspector coordinate modifiers
  const updateBlockX = (x: number) => {
    if (!selectedBlock || selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0) return;
    const newSections = [...definition.sections];
    newSections[selectedRowIndex].columns[selectedColIndex].blocks[selectedBlockIndex].x = x;
    updateDefinitionWithHistory({ ...definition, sections: newSections });
  };

  const updateBlockY = (y: number) => {
    if (!selectedBlock || selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0) return;
    const newSections = [...definition.sections];
    newSections[selectedRowIndex].columns[selectedColIndex].blocks[selectedBlockIndex].y = y;
    updateDefinitionWithHistory({ ...definition, sections: newSections });
  };

  const updateBlockWidth = (width: number) => {
    if (!selectedBlock || selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0) return;
    const newSections = [...definition.sections];
    newSections[selectedRowIndex].columns[selectedColIndex].blocks[selectedBlockIndex].width = width;
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

  const handleAddBlock = (type: BlockType, dropCoords?: { x: number; y: number }) => {
    const defaultW = getDefaultBlockWidth(type);
    const isFreeform = Boolean(dropCoords || definition.theme.backgroundImage || definition.sections.length === 0);

    let initialX = dropCoords?.x;
    let initialY = dropCoords?.y;

    if (isFreeform && (initialX === undefined || initialY === undefined)) {
      const existingCount = definition.sections.reduce((acc, s) => acc + s.columns.reduce((a, c) => a + c.blocks.length, 0), 0);
      initialX = 20;
      initialY = Math.min(240, 25 + existingCount * 25);
    }

    const newBlock: LayoutBlock = {
      id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      x: initialX,
      y: initialY,
      width: isFreeform ? defaultW : undefined,
      props: type === "text_block"
        ? { content: "Add your custom note, payment terms, or announcement text here." }
        : type === "invoice_meta"
          ? { title: "INVOICE", showDueDate: true }
          : type === "document_title"
            ? { title: "INVOICE" }
            : type === "invoice_number"
              ? { label: "Invoice No: ", showLabel: true }
              : type === "invoice_date"
                ? { label: "Date: ", showLabel: true }
                : type === "due_date"
                  ? { label: "Due Date: ", showLabel: true }
                  : type === "total_subtotal"
                    ? { label: "Subtotal: ", showLabel: true, showCurrency: true }
                    : type === "total_discount"
                      ? { label: "Discount: ", showLabel: true, showCurrency: true, showPrefix: true, prefix: "− " }
                      : type === "total_tax"
                        ? { label: "Tax (8%): ", showLabel: true, showCurrency: true, showPrefix: true, prefix: "+ " }
                        : type === "total_advance"
                          ? { label: "Advance Paid: ", showLabel: true, showCurrency: true, showPrefix: true, prefix: "− " }
                          : type === "total_invoice"
                            ? { label: "Total: ", showLabel: true, showCurrency: true }
                            : type === "total_due"
                              ? { label: "Balance Due: ", showLabel: true, showCurrency: true }
                              : type === "bill_to"
                                ? { label: "Bill To:" }
                                : type === "amount_due_callout"
                                  ? { label: "Amount Due" }
                                  : type === "signature"
                                    ? { label: "Authorized Signature" }
                                    : type === "image_block"
                                      ? { maxHeight: 80, maxWidth: 180 }
                                      : {},
      styles: { align: "left" },
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
    if (selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0 || !selectedBlock) return;
    const newSections = [...definition.sections];
    const b = newSections[selectedRowIndex].columns[selectedColIndex].blocks[selectedBlockIndex];
    b.props = { ...b.props, ...newProps };
    updateDefinitionWithHistory({ ...definition, sections: newSections });
  };

  // Helper to update styles of currently selected block
  const updateBlockStyles = (newStyles: Partial<BlockStyle>) => {
    if (selectedRowIndex < 0 || selectedColIndex < 0 || selectedBlockIndex < 0 || !selectedBlock) return;
    const newSections = [...definition.sections];
    const b = newSections[selectedRowIndex].columns[selectedColIndex].blocks[selectedBlockIndex];
    b.styles = { ...b.styles, ...newStyles };
    updateDefinitionWithHistory({ ...definition, sections: newSections });
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

  // Upload blank format background template file
  const handleUploadBackgroundFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // When user adds an image, clear already existing blocks so they can add fields directly over it
      updateDefinitionWithHistory({
        ...definition,
        sections: [],
        theme: {
          ...definition.theme,
          backgroundImage: dataUrl,
          backgroundOpacity: definition.theme.backgroundOpacity ?? 1,
          backgroundFit: definition.theme.backgroundFit ?? "cover",
        },
      });
      setSelectedBlockId(null);
      setSuccessMsg("Background image added & existing blocks cleared. You can now place fields over it.");
      setTimeout(() => setSuccessMsg(null), 3500);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Upload custom image into an image_block or signature
  const handleUploadBlockImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBlock) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (selectedBlock?.type === "signature") {
        updateBlockProps({ signatureImageUrl: dataUrl });
      } else {
        updateBlockProps({ url: dataUrl });
      }
    };
    reader.readAsDataURL(file);
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
            {draftSavedTime && (
              <p className="text-[10px] text-muted-foreground pl-1">Autosaved locally {draftSavedTime}</p>
            )}
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
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Y)"
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

          {/* Compliance badge */}
          <div className="hidden md:flex items-center gap-2">
            {compulsoryStatus.valid ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" />
                <span>All Required Fields Added</span>
              </span>
            ) : (
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20"
                title={`Missing: ${compulsoryStatus.missingBlocks.join(", ")}`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Missing: {compulsoryStatus.missingBlocks[0]}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleClearCanvas}
            title="Clear all existing blocks from the canvas"
            className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => updateDefinitionWithHistory(STANDARD_LAYOUT_DEFINITION)}
            className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save Layout"}</span>
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
        <aside className="w-72 border-r border-border/80 bg-card/25 backdrop-blur-md flex flex-col shrink-0 overflow-y-auto p-4 space-y-6">
          {/* Helper function to render a category */}
          {[
            {
              title: "Separate Document Fields",
              category: "Separate Fields" as const,
              subtitle: "Place individual fields anywhere",
            },
            {
              title: "Separate Totals & Amounts",
              category: "Separate Totals" as const,
              subtitle: "Place individual amounts anywhere",
            },
            {
              title: "Grouped Blocks & Table",
              category: "Grouped Blocks" as const,
              subtitle: "Multi-field sections",
            },
            {
              title: "Brand & Business",
              category: "Brand" as const,
            },
            {
              title: "Custom Elements",
              category: "Custom" as const,
            },
            {
              title: "Payment & Notes",
              category: "Payment" as const,
            },
            {
              title: "Layout Helpers",
              category: "Extra" as const,
            },
          ].map((cat) => {
            const blocks = PALETTE_BLOCKS.filter((p) => p.category === cat.category);
            if (blocks.length === 0) return null;
            return (
              <div key={cat.category}>
                <div className="mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat.title}</h3>
                  {cat.subtitle && <p className="text-[10px] text-muted-foreground/70">{cat.subtitle}</p>}
                </div>
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
          {/* Zoom & Canvas controls bar */}
          <div className="sticky top-0 z-20 mb-6 bg-card/60 backdrop-blur-md border border-border/80 px-3 py-1.5 rounded-full flex items-center gap-3 shadow-md">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.1).toFixed(1))))}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium text-foreground w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(1.4, Number((s + 0.1).toFixed(1))))}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="w-px h-4 bg-border" />
            <button
              type="button"
              onClick={() => setScale(0.8)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Fit
            </button>
            <span className="w-px h-4 bg-border" />
            <button
              type="button"
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${snapToGrid
                  ? "bg-brand-500/15 text-brand-500 border border-brand-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
                }`}
              title={snapToGrid ? "Snap to 5mm Grid (Enabled)" : "Snap to Grid (Disabled)"}
            >
              <Magnet className="w-4 h-4" />
            </button>
          </div>

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
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-brand-500" />
                    <span>Blank Format / Background</span>
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
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-500" />
                    <span>Apply Format To</span>
                  </label>
                  <span className="text-[10px] font-semibold text-brand-500 capitalize bg-brand-500/10 px-2 py-0.5 rounded-full">
                    {documentType === "both" ? "Both Documents" : documentType === "invoice" ? "Invoice Only" : "Quotation Only"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Select whether this layout format is used for invoices, quotations, or both.
                </p>
                <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xl">
                  {([
                    { id: "both", label: "Both" },
                    { id: "invoice", label: "Invoice Only" },
                    { id: "quotation", label: "Quotation Only" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDocumentType(opt.id)}
                      className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-lg transition-all text-center cursor-pointer ${
                        documentType === opt.id
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

              <div className="pt-2 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded border-border text-brand-500"
                  />
                  <span className="font-semibold text-foreground">Set as Workspace Default</span>
                </label>
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
                      <h4 className="font-bold text-foreground capitalize">
                        {(selectedBlock as LayoutBlock).type.replace("_", " ")}
                      </h4>
                      <p className="text-[10px] text-muted-foreground">ID: {(selectedBlock as LayoutBlock).id}</p>
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

                  {/* PHOTOSHOP POSITION & DIMENSIONS (FREEFORM MM) */}
                  <div className="space-y-3 p-3 bg-muted/20 border border-border rounded-2xl">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5 text-brand-500" />
                        <span>Position & Size (mm)</span>
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
                              min={0}
                              max={200}
                              value={(selectedBlock as LayoutBlock).x ?? 0}
                              onChange={(e) => updateBlockX(Number(e.target.value) || 0)}
                              className="w-full bg-card/40 hover:bg-card/60 focus:bg-card/60 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Y (mm)</label>
                            <input
                              type="number"
                              min={0}
                              max={290}
                              value={(selectedBlock as LayoutBlock).y ?? 0}
                              onChange={(e) => updateBlockY(Number(e.target.value) || 0)}
                              className="w-full bg-card/40 hover:bg-card/60 focus:bg-card/60 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Width (mm)</label>
                            <input
                              type="number"
                              min={20}
                              max={210}
                              value={(selectedBlock as LayoutBlock).width ?? 80}
                              onChange={(e) => updateBlockWidth(Number(e.target.value) || 80)}
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
                                updateBlockX(Math.max(0, Math.round((pw - w) / 2)));
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
                                updateBlockX(Math.max(0, Math.round(pw - 15 - w)));
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
                                updateBlockWidth(Math.round(pw - 30));
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
                        <p className="text-[11px] text-muted-foreground">
                          This block is currently aligned in a column flow. Make it freeform to drag and place anywhere on the paper.
                        </p>
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
                        <p className="text-[10px] text-muted-foreground">
                          Leave blank to automatically use your Business Profile name.
                        </p>
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
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Leave empty to automatically match document type (INVOICE or QUOTATION).
                          </p>
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
                        <p className="text-[11px] text-muted-foreground">
                          Turn off &quot;Include Label&quot; to show only the number (e.g. INV-2026-0842) for positioning directly over pre-printed stationery.
                        </p>
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
                        <p className="text-[11px] text-muted-foreground">
                          Turn off &quot;Include Label&quot; to show only the date (e.g. Oct 10, 2026).
                        </p>
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
                        <p className="text-[11px] text-muted-foreground">
                          Turn off &quot;Include Label&quot; to show only the due date (e.g. Oct 24, 2026).
                        </p>
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
                            placeholder="e.g. ABC Company Ltd"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">Billing Address</label>
                          <input
                            type="text"
                            value={(selectedBlock as LayoutBlock).props?.billingAddress ?? ""}
                            onChange={(e) => updateBlockProps({ billingAddress: e.target.value })}
                            placeholder="e.g. 123 Business Street, City Name"
                            className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* 5. Amount Due Callout */}
                    {(selectedBlock as LayoutBlock).type === "amount_due_callout" && (
                      <div className="space-y-2">
                        <label className="font-semibold text-foreground block mb-1">
                          Callout Title / Label <span className="text-[10px] text-muted-foreground font-normal">(Leave empty for no title)</span>
                        </label>
                        <input
                          type="text"
                          value={(selectedBlock as LayoutBlock).props?.label ?? ""}
                          onChange={(e) => updateBlockProps({ label: e.target.value })}
                          placeholder="Leave empty for no title (amount only)"
                          className="w-full bg-card/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:border-brand-500 outline-none"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Leave blank to show only the formatted amount without the &quot;Amount Due&quot; header.
                        </p>
                      </div>
                    )}

                    {/* Individual Totals & Amounts */}
                    {(selectedBlock as LayoutBlock).type.startsWith("total_") && (
                      <div className="space-y-3">
                        <div className="p-2.5 rounded-xl border border-border bg-card/60 text-muted-foreground text-[11px] leading-relaxed">
                          <span className="font-semibold text-foreground">Separate Amount field.</span> Can display with or without a title, perfect for pre-printed blank formats.
                        </div>

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
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean((selectedBlock as LayoutBlock).props?.striped)}
                            onChange={(e) => updateBlockProps({ striped: e.target.checked })}
                            className="rounded border-border text-brand-500"
                          />
                          <span className="font-medium text-foreground">Alternating / Striped Rows</span>
                        </label>
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
                            placeholder="e.g. ABC Company"
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
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Customize note message for this layout. Invoices will display this text.
                          </p>
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
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Customize payment terms, warranty info, or policy conditions.
                          </p>
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
                      Styling & Layout
                    </h5>

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
                      <label className="font-bold text-foreground block mb-1">Font Size (pt)</label>
                      <input
                        type="number"
                        min={8}
                        max={36}
                        value={selectedBlock?.styles?.fontSize || definition.theme.baseFontSize}
                        onChange={(e) => updateBlockStyles({ fontSize: Number(e.target.value) || undefined })}
                        className="w-full bg-card/40 border border-border rounded-xl px-3 py-2 text-foreground"
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
