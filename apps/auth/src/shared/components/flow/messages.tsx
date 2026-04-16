import type { KratosUiMessage } from "@/shared/lib/kratos";
import { cn } from "@/shared/lib/utils";
import { Alert } from "@/shared/components/ui/alert";

interface FlowMessagesProps {
  messages: KratosUiMessage[];
}

function getToneClass(type: KratosUiMessage["type"]) {
  if (type === "error") return "border-destructive/60 text-destructive";
  if (type === "warning") return "border-amber-500/50 text-amber-700";
  if (type === "success") return "border-emerald-500/50 text-emerald-700";
  return "border-border text-foreground";
}

export function FlowMessages({ messages }: FlowMessagesProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flow-messages space-y-2">
      {messages.map((message, index) => (
        <Alert
          key={`${message.id ?? index}-${index}`}
          className={cn("text-sm", getToneClass(message.type))}
        >
          {message.text}
        </Alert>
      ))}
    </div>
  );
}
