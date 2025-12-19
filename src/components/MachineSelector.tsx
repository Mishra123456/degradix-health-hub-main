import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MachineSelectorProps {
  machines: string[];
  value: string;
  onChange: (value: string) => void;
}

export function MachineSelector({
  machines,
  value,
  onChange,
}: MachineSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px] bg-card">
        <SelectValue placeholder="Select Machine" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {machines.map((machine) => (
          <SelectItem key={machine} value={machine}>
            {machine}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
