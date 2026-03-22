"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, InputProps } from "@/frontend/components/ui/input";
import { cn } from "@/shared/lib/utils";

interface PasswordInputProps extends Omit<InputProps, "type"> {
    wrapperClassName?: string;
}

export default function PasswordInput({
    className,
    wrapperClassName,
    ...props
}: PasswordInputProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className={cn("relative", wrapperClassName)}>
            <Input
                {...props}
                type={isVisible ? "text" : "password"}
                className={cn("pr-11", className)}
            />
            <button
                type="button"
                onClick={() => setIsVisible((currentValue) => !currentValue)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition hover:text-foreground"
                aria-label={isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    );
}
