import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Box = "div" as const;

interface AuthPhoneFieldProps {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  errorText?: string | null;
}

export function AuthPhoneField({
  id,
  value,
  onChange,
  onBlur,
  disabled = false,
  label = "Phone Number",
  helperText = "We'll send an OTP to verify",
  errorText = null,
}: AuthPhoneFieldProps) {
  return (
    <Box className="space-y-2">
      <Label htmlFor={id} className="text-gray-700">
        {label}
      </Label>
      <Box className="flex gap-2">
        <Box className="w-14 flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm shrink-0">
          +91
        </Box>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit number"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          onBlur={onBlur}
          disabled={disabled}
          aria-required="true"
          aria-describedby={errorText ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className="bg-white flex-1"
        />
      </Box>
      {errorText ? (
        <p id={`${id}-error`} className="text-sm text-destructive">{errorText}</p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-gray-500">{helperText}</p>
      ) : null}
    </Box>
  );
}
