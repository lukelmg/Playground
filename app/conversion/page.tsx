"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import * as math from 'mathjs';

interface Result {
  value: string;
  inMeters: string | null;
}

interface UnitDefinition {
  name: string;
  base: {
    key: string;
  };
  prefixes?: string[];
}

interface UnitConversion {
  baseType: string;
  power: number;
  conversions: {
    unit: string;
    value: string;
  }[];
}

export default function ConversionPage() {
  const defaultValue = "x=2kg*m^2/s^2";
  const [value, setValue] = React.useState<string>(defaultValue);
  const [result, setResult] = React.useState<Result>({
    value: "",
    inMeters: null
  });
  const [conversions, setConversions] = React.useState<UnitConversion[]>([]);
  const [showDialog, setShowDialog] = React.useState(false);

  React.useEffect(() => {
    evaluateExpression(defaultValue);
  }, []);

  const getCompatibleUnits = (baseType: string) => {
    return Object.entries(math.Unit.UNITS)
      .filter(([, def]) => (def as unknown as UnitDefinition).base?.key === baseType)
      .map(([unitName]) => unitName);
  };

  const removeDuplicateConversions = (conversions: { unit: string; value: string; }[]) => {
    // Group conversions by their numerical value
    const valueGroups = new Map<string, { unit: string; value: string; }[]>();
    
    conversions.forEach(conv => {
      // Extract just the numerical part for comparison
      const numericValue = conv.value.split(' ')[0];
      if (!valueGroups.has(numericValue)) {
        valueGroups.set(numericValue, []);
      }
      valueGroups.get(numericValue)?.push(conv);
    });

    // For each group, keep only the conversion with the longest unit name
    return Array.from(valueGroups.values()).map(group => 
      group.reduce((longest, current) => 
        current.unit.length > longest.unit.length ? current : longest
      )
    );
  };

  const getConversions = (evaluated: math.Unit | string | number) => {
    try {
      const unit = typeof evaluated === 'string' || typeof evaluated === 'number'
        ? math.unit(evaluated.toString())
        : evaluated;

      if (!unit || typeof unit.toNumber !== 'function') {
        return []; // Not a unit
      }

      const units = unit.units;
      const results: UnitConversion[] = [];
      
      if (units.length > 0) {
        const seenBaseTypes = new Set<string>();
        
        units.forEach(unitPart => {
          const baseKey = unitPart.unit.base.key;
          if (!seenBaseTypes.has(baseKey)) {
            seenBaseTypes.add(baseKey);
            
            const compatibleUnits = getCompatibleUnits(baseKey);
            const conversions: { unit: string; value: string; }[] = [];
            
            try {
              const testUnit = math.unit('1 ' + unitPart.unit.name);
              
              compatibleUnits.forEach(compatibleUnit => {
                try {
                  const converted = testUnit.to(compatibleUnit);
                  conversions.push({
                    unit: compatibleUnit,
                    value: converted.toString()
                  });
                } catch {
                  // Skip incompatible units
                }
              });

              // Remove duplicates before adding to results
              const uniqueConversions = removeDuplicateConversions(conversions);

              results.push({
                baseType: baseKey,
                power: unitPart.power,
                conversions: uniqueConversions
              });
            } catch {
              // Skip if unable to convert
            }
          }
        });
      }
      
      return results;
    } catch {
      return []; // Not a unit
    }
  };

  const evaluateExpression = (input: string) => {
    try {
      if (!input.trim()) {
        setResult({ value: "", inMeters: null });
        setConversions([]);
        return;
      }
      const evaluated = math.evaluate(input);
      let metersValue: string | null = null;

      // Get all possible conversions
      const newConversions = getConversions(evaluated);
      setConversions(newConversions);

      // Try to convert to meters if it's a unit
      try {
        const inMeters = math.unit(evaluated);
        metersValue = inMeters.toString();
      } catch {
        // Not a unit or cannot be converted to meters
        metersValue = null;
      }

      setResult({
        value: evaluated.toString(),
        inMeters: metersValue
      });
    } catch {
      setResult({ value: "Invalid expression", inMeters: null });
      setConversions([]);
    }
  };

  return (
    <div className="p-4 flex gap-4 items-center">
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          evaluateExpression(e.target.value);
        }}
        placeholder="Enter mathematical expression or unit (e.g., 5 m/s, 10 ft^3)..."
        className="max-w-sm"
      />
      <div className="min-w-[200px] p-2 border rounded-md bg-muted">
        {result.value || "Result will appear here"}
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="min-w-[200px]">
            Show Conversions
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Available Unit Conversions</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 overflow-x-auto p-4">
            {conversions.map((conversion, i) => (
              <div key={i} className="flex-none w-[300px]">
                <div className="font-medium mb-2">
                  {conversion.baseType} (power: {conversion.power})
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-2">
                  {conversion.conversions.map((conv, j) => (
                    <div key={j} className="text-sm">
                      <span className="font-mono">{conv.unit}:</span> {conv.value}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {conversions.length === 0 && (
              <div className="text-muted-foreground">
                No unit conversions available for this expression
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
