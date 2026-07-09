"use client";

import * as React from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: number;
}

type FormatCommand = "bold" | "italic" | "insertUnorderedList" | "insertOrderedList";

function ToolbarButton({
  active,
  onClick,
  children,
  label,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Write something...",
  disabled = false,
  className,
  minHeight = 160,
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = React.useState<
    Record<string, boolean>
  >({});

  const syncValue = React.useCallback(() => {
    if (!editorRef.current) return;
    onChange?.(editorRef.current.innerHTML);
  }, [onChange]);

  const updateActiveFormats = React.useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
    });
  }, []);

  const execFormat = (command: FormatCommand) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false);
    syncValue();
    updateActiveFormats();
  };

  const clearFormatting = () => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand("removeFormat", false);
    syncValue();
    updateActiveFormats();
  };

  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const isEmpty = !value || value === "<br>" || value.trim() === "";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-background shadow-sm",
        disabled && "opacity-60",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1.5">
        <ToolbarButton
          label="Bold"
          active={activeFormats.bold}
          onClick={() => execFormat("bold")}
          disabled={disabled}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={activeFormats.italic}
          onClick={() => execFormat("italic")}
          disabled={disabled}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label="Bullet list"
          active={activeFormats.insertUnorderedList}
          onClick={() => execFormat("insertUnorderedList")}
          disabled={disabled}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={activeFormats.insertOrderedList}
          onClick={() => execFormat("insertOrderedList")}
          disabled={disabled}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label="Clear formatting"
          onClick={clearFormatting}
          disabled={disabled}
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="relative">
        {isEmpty && (
          <p className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label="Rich text editor"
          aria-disabled={disabled}
          className={cn(
            "prose prose-sm max-w-none px-3 py-3 text-sm focus:outline-none",
            "prose-ul:list-disc prose-ol:list-decimal prose-li:my-0.5",
            "[&:empty]:before:content-none"
          )}
          style={{ minHeight }}
          onInput={syncValue}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onBlur={syncValue}
        />
      </div>
    </div>
  );
}
