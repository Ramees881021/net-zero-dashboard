import { useState } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Database, Users } from 'lucide-react';
import { SCOPE3_CATEGORIES } from '@/lib/emission-factors';
import { SupplierPipeline } from './SupplierPipeline';
import { TemplateManager } from './TemplateManager';

interface FolderNode {
  id: string;
  label: string;
  children?: FolderNode[];
  component?: string;
}

const folderTree: FolderNode[] = [
  {
    id: 'scope1',
    label: 'Scope 1 – Direct Emissions',
    children: [],
  },
  {
    id: 'scope2',
    label: 'Scope 2 – Indirect Emissions',
    children: [],
  },
  {
    id: 'scope3',
    label: 'Scope 3 – Value Chain Emissions',
    children: [
      { id: 'scope3_suppliers', label: 'Suppliers', component: 'suppliers' },
      ...SCOPE3_CATEGORIES.map(cat => ({
        id: `scope3_${cat.code}`,
        label: cat.label,
        component: `template_${cat.code}`,
      })),
    ],
  },
];

const FolderItem = ({
  node,
  depth = 0,
  onSelect,
  selectedId,
}: {
  node: FolderNode;
  depth?: number;
  onSelect: (id: string, component?: string) => void;
  selectedId: string | null;
}) => {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isClickable = hasChildren || !!node.component;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setOpen(!open);
          if (node.component) onSelect(node.id, node.component);
        }}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors ${
          isClickable ? 'cursor-pointer' : 'cursor-default'
        } ${isSelected ? 'bg-primary/10 text-primary font-medium' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {node.id === 'scope3_suppliers' ? (
          <Users className="h-4 w-4 text-primary shrink-0" />
        ) : open ? (
          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-primary shrink-0" />
        )}
        <span className="truncate">{node.label}</span>
      </button>
      {open && hasChildren && (
        <div>
          {node.children!.map(child => (
            <FolderItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DatabaseTab = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeComponent, setActiveComponent] = useState<string | null>(null);

  const handleSelect = (id: string, component?: string) => {
    setSelectedId(id);
    setActiveComponent(component || null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Database className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Database</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Browse your emissions data organised by scope and category. Click <strong>Suppliers</strong> to upload & classify.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Folder tree */}
        <div className="border rounded-lg bg-card p-2 space-y-0.5 lg:col-span-1">
          {folderTree.map(node => (
            <FolderItem
              key={node.id}
              node={node}
              onSelect={handleSelect}
              selectedId={selectedId}
            />
          ))}
        </div>

        {/* Content panel */}
        <div className="lg:col-span-2">
          {!activeComponent && (
            <div className="border rounded-lg bg-card p-8 text-center text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a folder to view its contents</p>
            </div>
          )}

          {activeComponent === 'suppliers' && (
            <SupplierPipeline onComplete={() => {}} />
          )}

          {activeComponent?.startsWith('template_') && (
            <TemplateManager category={activeComponent.replace('template_', '')} />
          )}
        </div>
      </div>
    </div>
  );
};
