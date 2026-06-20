import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MachineSelectorProps {
  machines: number[];
  value: number | null;
  onChange: (value: number) => void;
}

export function MachineSelector({
  machines,
  value,
  onChange,
}: MachineSelectorProps) {
  return (
    <Select 
      value={value !== null ? value.toString() : undefined} 
      onValueChange={(val) => onChange(Number(val))}
    >
      <SelectTrigger className="w-[200px] bg-card">
        <SelectValue placeholder="Select Machine" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {machines.map((machine) => (
          <SelectItem key={machine} value={machine.toString()}>
            Engine {machine}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
