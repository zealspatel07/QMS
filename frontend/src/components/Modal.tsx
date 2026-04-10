// src/components/Modal.tsx
import React from 'react';
import styles from './Modal.module.css';

type Props = {
  title?: string;
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

export default function Modal({ title, open, onClose, children, footer }: Props) {
  if (!open) return null;
  return (
    <div className={styles.modalWrapper}>
      <div className={styles.modalHeader}>
        <div className={styles.headerInner}>
          <h3  className={styles.modalTitle}>{title}</h3>
          <button onClick={onClose} aria-label="close"> ✕ </button>
        </div>
        <div>{children}</div>
        {footer && <div  className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}
