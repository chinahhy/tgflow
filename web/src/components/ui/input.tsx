"use client";

import * as React from "react";
import { t } from "@/lib/i18n";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onInvalid, onInput, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
        onInput={(event) => {
          event.currentTarget.setCustomValidity("");
          onInput?.(event);
        }}
        onInvalid={(event) => {
          onInvalid?.(event);
          if (event.defaultPrevented) return;
          const input = event.currentTarget;
          const validity = input.validity;
          input.setCustomValidity(
            validity.valueMissing
              ? t("This field is required")
              : validity.tooShort
                ? t("Please enter at least {count} characters", {
                    count: input.minLength,
                  })
                : validity.tooLong
                  ? t("Please enter no more than {count} characters", {
                      count: input.maxLength,
                    })
                  : t("Please enter a valid value"),
          );
        }}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
