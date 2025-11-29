import { useState } from 'react';
import { Link } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { SchemaPreset } from '@config-editor/core';

interface LoadFromUrlDialogProps {
  onLoadUrl: (url: string, schemaId: string | null) => Promise<void>;
  schemas: SchemaPreset[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LoadFromUrlDialog({ onLoadUrl, schemas, open: controlledOpen, onOpenChange }: LoadFromUrlDialogProps) {
  const [url, setUrl] = useState('');
  const [schemaId, setSchemaId] = useState<string>('__none__');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const handleLoad = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onLoadUrl(url.trim(), schemaId === '__none__' ? null : schemaId);
      setOpen(false);
      setUrl('');
      setSchemaId('__none__');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file from URL');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setUrl('');
      setSchemaId('__none__');
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Load File from URL</DialogTitle>
          <DialogDescription>
            Enter a URL to a YAML or JSON file to open it in the editor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="url" className="text-sm font-medium">
              URL
            </label>
            <Input
              id="url"
              placeholder="https://example.com/config.yaml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleLoad();
                }
              }}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="schema" className="text-sm font-medium">
              Schema (optional)
            </label>
            <Select value={schemaId} onValueChange={setSchemaId} disabled={isLoading}>
              <SelectTrigger id="schema">
                <SelectValue placeholder="No schema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No schema</SelectItem>
                {schemas.map((schema) => (
                  <SelectItem key={schema.id} value={schema.id}>
                    {schema.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleLoad} disabled={isLoading || !url.trim()}>
            {isLoading ? 'Loading...' : 'Load'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
