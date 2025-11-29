export interface FieldLabelProps {
  name: string;
  title: string;
  required?: boolean;
  summaryLabel?: string | null;
  className?: string;
  as?: 'label' | 'span';
}

export function FieldLabel({
  name,
  title,
  required,
  summaryLabel,
  className = '',
  as = 'label',
}: FieldLabelProps) {
  const isArrayIndex = /^\[\d+\]$/.test(name);

  const renderContent = () => {
    if (isArrayIndex && summaryLabel) {
      return (
        <>
          <span className="font-mono text-xs text-muted-foreground/70">{name}</span>
          <span className="font-medium"> {summaryLabel}</span>
        </>
      );
    }
    if (isArrayIndex) {
      return <span className="font-mono text-xs text-muted-foreground/70">{name}</span>;
    }
    return title;
  };

  const Tag = as;
  return (
    <Tag className={`text-sm ${isArrayIndex ? '' : 'font-medium'} text-foreground ${className}`}>
      {renderContent()}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </Tag>
  );
}
