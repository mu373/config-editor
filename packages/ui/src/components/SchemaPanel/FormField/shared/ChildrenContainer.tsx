export interface ChildrenContainerProps {
  children: React.ReactNode;
  onCollapse?: () => void;
}

export function ChildrenContainer({ children, onCollapse }: ChildrenContainerProps) {
  return (
    <div className="relative mt-1 pl-6">
      {onCollapse ? (
        <div
          className="absolute left-0 top-0 bottom-0 w-4 cursor-pointer group"
          onClick={onCollapse}
          title="Click to collapse"
        >
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border group-hover:bg-primary/50 transition-colors" />
        </div>
      ) : (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />
      )}
      {children}
    </div>
  );
}
