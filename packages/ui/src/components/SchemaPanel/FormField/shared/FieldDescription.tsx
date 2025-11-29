export interface FieldDescriptionProps {
  children: React.ReactNode;
  noMargin?: boolean;
  inline?: boolean;
}

export function FieldDescription({ children, noMargin = false, inline = false }: FieldDescriptionProps) {
  return (
    <p
      className={`text-xs text-muted-foreground/70 ${inline ? 'ml-[12.75rem]' : ''} ${
        noMargin ? '' : 'mt-1'
      }`}
    >
      {children}
    </p>
  );
}
