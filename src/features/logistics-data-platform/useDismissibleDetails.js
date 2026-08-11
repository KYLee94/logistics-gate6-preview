import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export function useDismissiblePopover({
  open,
  onClose,
  containerRef: providedContainerRef,
  triggerRef: providedTriggerRef,
}) {
  const fallbackContainerRef = useRef(null);
  const fallbackTriggerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const containerRef = providedContainerRef || fallbackContainerRef;
  const triggerRef = providedTriggerRef || fallbackTriggerRef;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const container = containerRef.current;
    const ownerDocument = container?.ownerDocument;
    if (!container || !ownerDocument) return undefined;

    const closeForOutsidePointer = (event) => {
      if (!container.contains(event.target)) onCloseRef.current?.('outside');
    };
    const closeForEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current?.('escape');
      triggerRef.current?.focus();
    };

    ownerDocument.addEventListener('pointerdown', closeForOutsidePointer, true);
    ownerDocument.addEventListener('keydown', closeForEscape);
    return () => {
      ownerDocument.removeEventListener('pointerdown', closeForOutsidePointer, true);
      ownerDocument.removeEventListener('keydown', closeForEscape);
    };
  }, [containerRef, open, triggerRef]);

  return { containerRef, triggerRef };
}

export function useDismissibleDetails() {
  const detailsRef = useRef(null);
  const summaryRef = useRef(null);
  const [open, setOpen] = useState(false);
  const closeDetails = useCallback(() => {
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
  }, []);
  const onDetailsToggle = useCallback((event) => {
    setOpen(event.currentTarget.open);
  }, []);

  useDismissiblePopover({
    open,
    onClose: closeDetails,
    containerRef: detailsRef,
    triggerRef: summaryRef,
  });

  return {
    closeDetails,
    detailsRef,
    onDetailsToggle,
    summaryRef,
  };
}
