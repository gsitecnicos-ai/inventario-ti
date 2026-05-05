"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className: string;
  disabled?: boolean;
};

export function SubmitButton({
  label,
  pendingLabel = "Salvando...",
  className,
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={className}
      aria-disabled={disabled || pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

type ConfirmSubmitButtonProps = SubmitButtonProps & {
  confirmMessage: string;
};

export function ConfirmSubmitButton({
  confirmMessage,
  ...props
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={props.disabled || pending}
      className={props.className}
      aria-disabled={props.disabled || pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? (props.pendingLabel ?? "Removendo...") : props.label}
    </button>
  );
}
