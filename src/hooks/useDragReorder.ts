import { useState, useCallback } from 'react';

interface DragState {
  draggedIndex: number | null;
  dragOverIndex: number | null;
}

export function useDragReorder<T extends { id: string }>(
  items: T[],
  onReorder: (reorderedItems: T[]) => void
) {
  const [dragState, setDragState] = useState<DragState>({
    draggedIndex: null,
    dragOverIndex: null,
  });

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDragState({ draggedIndex: index, dragOverIndex: null });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragState((prev) => ({ ...prev, dragOverIndex: index }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    if (dragIndex === dropIndex || isNaN(dragIndex)) {
      setDragState({ draggedIndex: null, dragOverIndex: null });
      return;
    }

    const reordered = [...items];
    const [removed] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, removed);
    
    onReorder(reordered);
    setDragState({ draggedIndex: null, dragOverIndex: null });
  }, [items, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragState({ draggedIndex: null, dragOverIndex: null });
  }, []);

  return {
    draggedIndex: dragState.draggedIndex,
    dragOverIndex: dragState.dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
