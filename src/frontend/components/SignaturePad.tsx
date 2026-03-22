"use client";

import React, { useRef, useSyncExternalStore, forwardRef, useImperativeHandle } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "./ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadRef {
    clear: () => void;
    isEmpty: () => boolean;
    toDataURL: () => string;
}

interface SignaturePadProps {
    label: string;
    onEnd?: () => void;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
    ({ label, onEnd }, ref) => {
        const padRef = useRef<SignatureCanvas>(null);
        const mounted = useSyncExternalStore(
            () => () => undefined,
            () => true,
            () => false
        );

        useImperativeHandle(ref, () => ({
            clear: () => padRef.current?.clear(),
            isEmpty: () => padRef.current?.isEmpty() ?? true,
            toDataURL: () => padRef.current?.getTrimmedCanvas().toDataURL("image/png") ?? "",
        }));

        if (!mounted) {
            return (
                <div className="w-full h-40 bg-muted/20 border-2 border-dashed border-muted rounded-md flex items-center justify-center text-muted-foreground">
                    Loading Signature Pad...
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-3 group">
                <div className="flex justify-between items-end px-1">
                    <span className="text-sm font-medium text-foreground/80 group-hover:text-primary transition-colors">{label}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => padRef.current?.clear()}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        <Eraser className="w-3.5 h-3.5 mr-1" />
                        Effacer
                    </Button>
                </div>
                <div className="border-2 border-dashed border-border group-hover:border-primary/30 rounded-2xl overflow-hidden bg-muted/20 hover:bg-muted/30 transition-colors relative">
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-primary/20 font-medium">Signer ici</span>
                    </div>
                    <SignatureCanvas
                        ref={padRef}
                        canvasProps={{
                            className: "w-full h-40 cursor-crosshair",
                        }}
                        onEnd={onEnd}
                        backgroundColor="transparent"
                    />
                </div>
            </div>
        );
    }
);

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
