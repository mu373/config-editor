export interface ChildrenContainerProps {
  children: React.ReactNode;
}

export function ChildrenContainer({ children }: ChildrenContainerProps) {
  return <div className="mt-1 border-l-2 border-border pl-6">{children}</div>;
}
