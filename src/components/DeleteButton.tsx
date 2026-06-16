'use client';

import { useTransition } from 'react';

interface Props {
  action: (formData: FormData) => Promise<void>;
  id: string;
  confirmMessage: string;
  label?: string;
  className?: string;
}

export function DeleteButton({ action, id, confirmMessage, label = 'Delete', className }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    const fd = new FormData();
    fd.append('id', id);
    startTransition(() => action(fd));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={
        className ??
        'px-4 py-2.5 rounded-[12px] text-[15px] font-medium text-[#FF3B30] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 transition-colors disabled:opacity-40'
      }
    >
      {isPending ? 'Deleting…' : label}
    </button>
  );
}
