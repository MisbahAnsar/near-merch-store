import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TagInputProps {
  label: string;
  hint?: string;
  placeholder: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  inputClassName?: string;
}

export function TagInput({
  label,
  hint,
  placeholder,
  tags,
  onTagsChange,
  inputClassName,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onTagsChange([...tags, trimmed]);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-foreground/60">{label}</Label>
      {hint && <p className="text-[11px] text-foreground/40">{hint}</p>}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          className={inputClassName ?? "h-9 bg-background/60 border border-border/60 rounded-lg text-sm"}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTag}
          disabled={!inputValue.trim()}
          className="h-9 shrink-0"
        >
          <Plus className="size-3.5 mr-1" />
          Add
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <Badge key={tag} variant="outline" className="font-normal text-xs h-7 gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-0.5 text-foreground/40 hover:text-foreground transition-colors"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}