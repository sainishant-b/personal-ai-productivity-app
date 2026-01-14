import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, CalendarClock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SwipeableTaskCard from "./SwipeableTaskCard";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  status: "not_started" | "in_progress" | "completed";
  due_date?: string;
  estimated_duration?: number;
  category: string;
  progress: number;
}

interface OverdueTasksSectionProps {
  tasks: Task[];
  onToggleComplete: (taskId: string, currentStatus: string) => void;
  onClick: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  onReschedule?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onRescheduleAll?: () => void;
}

const OverdueTasksSection = ({ 
  tasks, 
  onToggleComplete, 
  onClick,
  onSkip,
  onReschedule,
  onDelete,
  onRescheduleAll,
}: OverdueTasksSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-3 md:mb-4">
      <div 
        className="flex items-center gap-1.5 md:gap-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CollapsibleTrigger className="flex items-center gap-1.5 md:gap-2 flex-1 py-1.5 md:py-2 px-2 md:px-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors text-xs md:text-sm font-medium text-destructive">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />}
          <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span>Overdue Tasks</span>
          <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 ml-1">
            {tasks.length}
          </Badge>
        </CollapsibleTrigger>
        {onRescheduleAll && (isHovered || tasks.length > 0) && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRescheduleAll();
            }}
            className={`h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}
          >
            <CalendarClock className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
            Reschedule All
          </Button>
        )}
      </div>
      <CollapsibleContent className="mt-1.5 md:mt-2 space-y-1.5 md:space-y-2">
        {tasks.map((task) => (
          <SwipeableTaskCard
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onClick={onClick}
            onSkip={onSkip}
            onReschedule={onReschedule}
            onDelete={onDelete}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default OverdueTasksSection;
