import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface CreatePollPayload {
  question: string;
  options: string[];
  closesAt: string | null;
  isAnonymous: boolean;
}

interface CreatePollModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreatePollPayload) => void;
  isSubmitting?: boolean;
}

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

export function CreatePollModal({ open, onOpenChange, onSubmit, isSubmitting }: CreatePollModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [closesAt, setClosesAt] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const validOptions = options.filter((o) => o.trim().length > 0);
  const canSubmit =
    question.trim().length > 0 &&
    validOptions.length >= MIN_OPTIONS &&
    validOptions.length <= MAX_OPTIONS;

  const handledOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setQuestion("");
      setOptions(["", ""]);
      setClosesAt("");
      setIsAnonymous(false);
    }
  };

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOption = () => {
    setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ""] : prev));
  };

  const removeOption = (index: number) => {
    setOptions((prev) => (prev.length > MIN_OPTIONS ? prev.filter((_, i) => i !== index) : prev));
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      question: question.trim(),
      options: validOptions.map((o) => o.trim()),
      closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      isAnonymous,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handledOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Enquete</DialogTitle>
          <DialogDescription>Pergunte e veja os votos do grupo em tempo real.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="poll-question">Pergunta</Label>
            <Textarea
              id="poll-question"
              placeholder="Ex.: Qual o melhor horário para o encontro?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1.5 min-h-[72px] resize-none"
              maxLength={280}
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{question.length}/280</p>
          </div>

          <div className="space-y-2">
            <Label>Opções ({options.length}/{MAX_OPTIONS})</Label>
            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Opção ${index + 1}`}
                  maxLength={120}
                  className="flex-1"
                />
                {options.length > MIN_OPTIONS && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeOption(index)}
                    title="Remover opção"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1 text-xs"
                onClick={addOption}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar opção
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label htmlFor="poll-deadline">Prazo (opcional)</Label>
              <Input
                id="poll-deadline"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Se vazio, a enquete fica aberta sem prazo.
              </p>
            </div>

            <label
              className={cn(
                "flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2.5 cursor-pointer transition-colors",
                isAnonymous && "border-primary/40 bg-primary/5"
              )}
            >
              <Checkbox
                checked={isAnonymous}
                onCheckedChange={(v) => setIsAnonymous(!!v)}
                id="poll-anonymous"
              />
              <div className="leading-tight">
                <span className="text-sm font-medium">Enquete anônima</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Os votos não revelam quem votou.
                </p>
              </div>
            </label>
          </div>

          <Button className="w-full" onClick={submit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar Enquete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}