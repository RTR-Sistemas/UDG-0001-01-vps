import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function BackButton() {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate(-1)}
      className="text-foreground hover:bg-accent rounded-full h-9 w-9 flex-shrink-0"
      title="Voltar"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
