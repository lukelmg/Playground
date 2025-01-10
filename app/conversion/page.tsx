"use client";

import React from "react";
import { Input } from "@/components/ui/input";
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

interface DerivedUnit {
  name: string;
  definition: string;
  conversions: {
    unit: string;
    value: string;
  }[];
}

interface UnitConversion {
  baseType: string;
  power: number;
  conversions: {
    unit: string;
    value: string;
  }[];
  derivedUnits?: DerivedUnit[];
}

export default function ConversionPage() {
  const defaultValue = "x=2kg*m^2/s^2";
  const [value, setValue] = React.useState<string>(defaultValue);
  const [result, setResult] = React.useState<Result>({
    value: "",
    inMeters: null
  });
  const [conversions, setConversions] = React.useState<UnitConversion[]>([]);

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

  const findDerivedUnits = (evaluated: math.Unit) => {
    const derivedUnits: DerivedUnit[] = [];
    
    // Get the numerical value and base units of the evaluated unit
    const baseUnitString = evaluated.toString();
    const [, unitPart] = baseUnitString.split(' ');
    
    // Function to normalize unit string for comparison
    const normalizeUnitString = (str: string) => {
      try {
        // Convert to a unit and back to get standardized form
        const unit = math.unit(str);
        const baseForm = unit.toString().split(' ')[1];
        // Split into components, sort them, and rejoin
        return baseForm.split('*')
          .map(part => part.trim())
          .sort()
          .join('*');
      } catch {
        return str;
      }
    };

    // Function to check if two units are equivalent
    const areUnitsEquivalent = (unit1: string, unit2: string) => {
      try {
        // Create test units with value 1
        const test1 = math.unit(unit1);
        const test2 = math.unit(unit2);
        
        // Try converting between them (in both directions)
        try {
          test1.to(test2.units[0].unit.name);
          return true;
        } catch {
          try {
            test2.to(test1.units[0].unit.name);
            return true;
          } catch {
            // If direct conversion fails, compare normalized base units
            const base1 = normalizeUnitString(test1.toString().split(' ')[1]);
            const base2 = normalizeUnitString(test2.toString().split(' ')[1]);
            return base1 === base2;
          }
        }
      } catch {
        return false;
      }
    };

    // Find all equivalent units
    const equivalentUnits = new Set<string>();
    
    // Check all units in mathjs
    Object.entries(math.Unit.UNITS).forEach(([unitName]) => {
      try {
        // Skip dimensionless units and basic units
        if (unitName === '' || unitName.includes('1')) return;
        
        // Create a test unit of 1 of the current unit
        const testUnit = math.unit(`1 ${unitName}`);
        const testBaseString = testUnit.toString();
        const [, testUnitPart] = testBaseString.split(' ');
        
        // Check if units are equivalent (considering different arrangements)
        if (areUnitsEquivalent(`1 ${unitPart}`, `1 ${testUnitPart}`)) {
          equivalentUnits.add(unitName);
        }
      } catch {
        // Skip units that can't be converted
      }
    });

    // Find the main derived unit (prefer common units like joule, watt, etc.)
    const preferredUnits = ['joule', 'watt', 'newton', 'pascal', 'volt', 'ohm'];
    const mainUnit = Array.from(equivalentUnits).find(unit => preferredUnits.includes(unit)) || 
                  Array.from(equivalentUnits)[0];

    if (mainUnit) {
      try {
        // Get all compatible conversions for this derived unit
        const directConversions = getCompatibleUnits(mainUnit).map(compatibleUnit => {
          try {
            const converted = math.unit(`1 ${mainUnit}`).to(compatibleUnit);
            return {
              unit: compatibleUnit,
              value: converted.toString()
            };
          } catch {
            return null;
          }
        }).filter((conv): conv is { unit: string; value: string } => conv !== null);

        // Get equivalent derived units
        const equivalentConversions = Array.from(equivalentUnits)
          .filter(unit => unit !== mainUnit)
          .map(unit => {
            try {
              const converted = math.unit(`1 ${mainUnit}`).to(unit);
              return {
                unit,
                value: converted.toString()
              };
            } catch {
              return null;
            }
          })
          .filter((conv): conv is { unit: string; value: string } => conv !== null);

        // Combine all conversions
        const allConversions = [...directConversions, ...equivalentConversions];

        // Get the definition in base units
        const definition = math.unit(`1 ${mainUnit}`).toString();

        if (allConversions.length > 0) {
          derivedUnits.push({
            name: mainUnit,
            definition: definition,
            conversions: removeDuplicateConversions(allConversions)
          });
        }
      } catch {
        // Skip if unable to convert
      }
    }

    return derivedUnits;
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

        // Add derived units to the first conversion result
        if (results.length > 0) {
          const derivedUnits = findDerivedUnits(unit);
          if (derivedUnits.length > 0) {
            results[0].derivedUnits = derivedUnits;
          }
        }
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
    <div className="p-4 flex flex-col gap-4">
      <div className="flex gap-4 items-center">
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
      </div>

      {conversions.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          <div className="text-lg font-semibold">
            Unit Conversions
          </div>
          <div className="flex gap-4 overflow-x-auto">
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
          </div>
          
          {conversions[0]?.derivedUnits && conversions[0].derivedUnits.length > 0 && (
            <>
              <div className="w-full border-t border-border my-4" />
              <div className="text-lg font-semibold mb-2">
                Equivalent Derived Units
              </div>
              <div className="flex flex-col gap-4">
                {conversions[0].derivedUnits.map((derived, i) => (
                  <div key={i}>
                    <div className="font-medium mb-2">
                      {derived.name} ({derived.definition})
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-2">
                      {derived.conversions.map((conv, j) => (
                        <div key={j} className="text-sm">
                          <span className="font-mono">{conv.unit}:</span> {conv.value}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
